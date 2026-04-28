#!/usr/bin/env node
/**
 * SSW Compass — source-index ingestion script (Sprint 3 Batch 4).
 *
 * Reads data/source-index.jsonl, fetches each URL, computes SHA-256,
 * and imports documents into Discovery Engine data stores configured
 * by [infra/terraform/envs/staging](../infra/terraform/envs/staging).
 *
 * Runs locally via `pnpm run ingest [-- flags]`. See docs/adr/ADR-010
 * for the failure-mode policy this script implements.
 *
 * This script is NOT part of pnpm-workspace.yaml. It relies on deps
 * hoisted to the repo-root node_modules by the --filter=@ssw/server
 * install (tsx, zod, @google-cloud/discoveryengine — all already
 * present as SSW server transitive deps).
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DocumentServiceClient } from "@google-cloud/discoveryengine";
import { z } from "zod";

const PROJECT_ID = process.env["CLOUDSDK_CORE_PROJECT"] ?? "ssw-compass-prod-494613";
const LOCATION = "asia-northeast1";
const COLLECTION = "default_collection";
const BRANCH = "0";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_INLINE_BYTES = 1_000_000;
const USER_AGENT = "ssw-compass-ingest/1.0 (+https://github.com/sugukurukabe/ssw-compass)";

const PLACEHOLDER = "__PLACEHOLDER__";
const JSONL_PATH = resolve(process.cwd(), "data/source-index.jsonl");

const DATA_STORES = ["visa_legal", "visa_faq", "visa_secondary"] as const;
type DataStoreId = (typeof DATA_STORES)[number];

const SourceEntrySchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1),
  url: z.string().url(),
  ministry: z.enum(["moj", "mlit", "mhlw", "maff", "meti", "cao", "soumu", "ppc"]),
  datastore: z.enum(DATA_STORES),
  trustLevel: z.literal("primary_source"),
  tags: z.array(z.string()),
  lang: z.enum(["ja", "en"]),
  verifiedAt: z.string(),
  contentSha256: z.string(),
  notes: z.string().default(""),
  status: z.enum(["ok", "failed"]).optional(),
  lastRunAt: z.string().optional(),
  lastFailureReason: z.string().optional(),
});
type SourceEntry = z.infer<typeof SourceEntrySchema>;

type Mode = "fail-fast" | "best-effort";

interface CliArgs {
  dryRun: boolean;
  filter: DataStoreId | null;
  mode: Mode;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let filter: DataStoreId | null = null;
  let mode: Mode = "fail-fast";
  for (const raw of argv) {
    if (raw === "--") {
      // pnpm forwards "--" separator; no-op.
    } else if (raw === "--dry-run") {
      dryRun = true;
    } else if (raw.startsWith("--filter=")) {
      const value = raw.slice("--filter=".length);
      if (!(DATA_STORES as readonly string[]).includes(value)) {
        throw new Error(`--filter must be one of ${DATA_STORES.join(", ")}, got "${value}"`);
      }
      filter = value as DataStoreId;
    } else if (raw.startsWith("--mode=")) {
      const value = raw.slice("--mode=".length);
      if (value !== "fail-fast" && value !== "best-effort") {
        throw new Error(`--mode must be "fail-fast" or "best-effort", got "${value}"`);
      }
      mode = value;
    } else if (raw === "--help" || raw === "-h") {
      console.log(
        "Usage: pnpm run ingest [-- --dry-run] [--filter=visa_legal|visa_faq|visa_secondary] [--mode=fail-fast|best-effort]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${raw}`);
    }
  }
  return { dryRun, filter, mode };
}

async function readIndex(): Promise<SourceEntry[]> {
  const raw = await readFile(JSONL_PATH, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const entries: SourceEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    try {
      const parsed = SourceEntrySchema.parse(JSON.parse(line));
      entries.push(parsed);
    } catch (err) {
      throw new Error(
        `data/source-index.jsonl line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return entries;
}

type FailureKind = "PERMANENT" | "TRANSIENT";

interface FetchResult {
  ok: boolean;
  sha256?: string;
  bodyBytes?: Buffer;
  mimeType?: string;
  error?: { kind: FailureKind; reason: string };
}

async function fetchOnce(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/pdf,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (response.status >= 400 && response.status < 500) {
      return {
        ok: false,
        error: { kind: "PERMANENT", reason: `HTTP ${response.status} ${response.statusText}` },
      };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        error: { kind: "TRANSIENT", reason: `HTTP ${response.status} ${response.statusText}` },
      };
    }
    const contentType = response.headers.get("content-type") ?? "";
    const mimeType = contentType.split(";")[0]?.trim() ?? "application/octet-stream";
    if (
      !mimeType.startsWith("text/") &&
      mimeType !== "application/pdf" &&
      mimeType !== "application/xhtml+xml"
    ) {
      return {
        ok: false,
        error: { kind: "PERMANENT", reason: `unsupported content-type: ${mimeType}` },
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_INLINE_BYTES) {
      return {
        ok: false,
        error: {
          kind: "PERMANENT",
          reason: `body ${buffer.length} bytes exceeds ${MAX_INLINE_BYTES} bytes inline import limit`,
        },
      };
    }
    const sha = createHash("sha256").update(buffer).digest("hex");
    return { ok: true, sha256: sha, bodyBytes: buffer, mimeType };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout")) {
      return {
        ok: false,
        error: { kind: "TRANSIENT", reason: `timeout after ${FETCH_TIMEOUT_MS}ms` },
      };
    }
    return { ok: false, error: { kind: "TRANSIENT", reason: message } };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string): Promise<FetchResult> {
  const backoffs = [0, 30_000, 120_000, 300_000];
  let attempt = 0;
  let last: FetchResult = { ok: false, error: { kind: "TRANSIENT", reason: "not attempted" } };
  for (const delay of backoffs) {
    if (delay > 0) {
      console.log(`  [retry ${attempt}] waiting ${delay / 1000}s before retry for ${url}`);
      await new Promise((r) => setTimeout(r, delay));
    }
    last = await fetchOnce(url);
    if (last.ok || last.error?.kind === "PERMANENT") return last;
    attempt += 1;
  }
  return {
    ok: false,
    error: {
      kind: "PERMANENT",
      reason: `${attempt} retries exhausted: ${last.error?.reason ?? "unknown"}`,
    },
  };
}

interface ProcessedEntry {
  entry: SourceEntry;
  sha256: string;
  bodyBytes: Buffer;
  mimeType: string;
}

interface FailedEntry {
  entry: SourceEntry;
  reason: string;
}

async function fetchAll(
  entries: SourceEntry[],
  mode: Mode,
): Promise<{ ok: ProcessedEntry[]; failed: FailedEntry[] }> {
  const ok: ProcessedEntry[] = [];
  const failed: FailedEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry === undefined) continue;
    process.stdout.write(`[${i + 1}/${entries.length}] ${entry.id} ${entry.url}... `);
    const result = await fetchWithRetry(entry.url);
    if (result.ok && result.sha256 !== undefined && result.bodyBytes !== undefined) {
      console.log(
        `OK (sha=${result.sha256.slice(0, 12)}..., ${result.bodyBytes.length}B, ${result.mimeType})`,
      );
      ok.push({
        entry,
        sha256: result.sha256,
        bodyBytes: result.bodyBytes,
        mimeType: result.mimeType ?? "text/html",
      });
    } else {
      const reason = result.error?.reason ?? "unknown";
      console.log(`FAIL [${result.error?.kind ?? "?"}] ${reason}`);
      failed.push({ entry, reason });
      if (mode === "fail-fast") {
        throw new Error(`Abort (fail-fast): ${entry.id} — ${reason}`);
      }
    }
  }
  return { ok, failed };
}

function groupByDataStore(processed: ProcessedEntry[]): Map<DataStoreId, ProcessedEntry[]> {
  const m = new Map<DataStoreId, ProcessedEntry[]>();
  for (const ds of DATA_STORES) m.set(ds, []);
  for (const p of processed) m.get(p.entry.datastore)?.push(p);
  return m;
}

function printDryRunReport(
  entries: SourceEntry[],
  ok: ProcessedEntry[],
  failed: FailedEntry[],
): void {
  console.log("");
  console.log("=== Dry-run report ===");
  console.log(`Total entries:  ${entries.length}`);
  console.log(`Fetch OK:       ${ok.length}`);
  console.log(`Fetch FAIL:     ${failed.length}`);
  console.log("");
  console.log("SHA-256 samples (first 5):");
  for (const p of ok.slice(0, 5)) {
    const current = p.entry.contentSha256;
    const next = p.sha256;
    const marker =
      current === PLACEHOLDER ? "  (new)" : current === next ? "  (same)" : "  (changed)";
    console.log(`  ${p.entry.id}:`);
    console.log(`    current: ${current}${marker}`);
    console.log(`    new:     ${next}`);
  }
  console.log("");
  console.log("Import plan by data store:");
  for (const [ds, items] of groupByDataStore(ok)) {
    console.log(`  ${ds}: ${items.length} docs`);
  }
  if (failed.length > 0) {
    console.log("");
    console.log("Failed entries:");
    for (const f of failed) console.log(`  ${f.entry.id}: ${f.reason}`);
  }
}

function makeProtobufStruct(entry: SourceEntry, sha256: string): object {
  return {
    fields: {
      title: { stringValue: entry.title },
      url: { stringValue: entry.url },
      ministry: { stringValue: entry.ministry },
      datastore: { stringValue: entry.datastore },
      trustLevel: { stringValue: entry.trustLevel },
      lang: { stringValue: entry.lang },
      publishedAt: { stringValue: entry.verifiedAt },
      contentSha256: { stringValue: sha256 },
      tags: {
        listValue: {
          values: entry.tags.map((t) => ({ stringValue: t })),
        },
      },
    },
  };
}

async function importToDataStore(
  client: DocumentServiceClient,
  ds: DataStoreId,
  items: ProcessedEntry[],
): Promise<{ success: number; failed: number; operationId: string }> {
  if (items.length === 0) {
    return { success: 0, failed: 0, operationId: "(skipped, 0 docs)" };
  }
  const parent = client.projectLocationCollectionDataStoreBranchPath(
    PROJECT_ID,
    LOCATION,
    COLLECTION,
    ds,
    BRANCH,
  );
  const documents = items.map((p) => ({
    id: p.entry.id,
    schemaId: "default_schema",
    structData: makeProtobufStruct(p.entry, p.sha256),
    content: {
      rawBytes: p.bodyBytes.toString("base64"),
      mimeType: p.mimeType,
    },
  }));
  const [operation] = await client.importDocuments({
    parent,
    inlineSource: { documents },
    reconciliationMode: "INCREMENTAL",
  });
  const operationId = operation.name ?? "(unnamed)";
  console.log(`  [${ds}] LRO started: ${operationId}`);
  const [_response, metadata] = await operation.promise();
  const meta = metadata as {
    successCount?: string | number;
    failureCount?: string | number;
  } | null;
  const successCount = Number(meta?.successCount ?? items.length);
  const failureCount = Number(meta?.failureCount ?? 0);
  return { success: successCount, failed: failureCount, operationId };
}

function serializeEntry(entry: SourceEntry): string {
  return JSON.stringify({
    id: entry.id,
    title: entry.title,
    url: entry.url,
    ministry: entry.ministry,
    datastore: entry.datastore,
    trustLevel: entry.trustLevel,
    tags: entry.tags,
    lang: entry.lang,
    verifiedAt: entry.verifiedAt,
    contentSha256: entry.contentSha256,
    notes: entry.notes,
    ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.lastRunAt !== undefined ? { lastRunAt: entry.lastRunAt } : {}),
    ...(entry.lastFailureReason !== undefined
      ? { lastFailureReason: entry.lastFailureReason }
      : {}),
  });
}

async function rewriteIndexWithHashes(
  originalEntries: readonly SourceEntry[],
  ok: readonly ProcessedEntry[],
): Promise<void> {
  const shaByDocId = new Map(ok.map((p) => [p.entry.id, p.sha256]));
  const lines: string[] = [];
  for (const entry of originalEntries) {
    const newSha = shaByDocId.get(entry.id);
    const updated: SourceEntry = newSha !== undefined ? { ...entry, contentSha256: newSha } : entry;
    lines.push(serializeEntry(updated));
  }
  await writeFile(JSONL_PATH, `${lines.join("\n")}\n`, "utf8");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`ssw-compass-ingest: project=${PROJECT_ID} location=${LOCATION}`);
  console.log(`flags: dry-run=${args.dryRun} filter=${args.filter ?? "(none)"} mode=${args.mode}`);

  const allEntries = await readIndex();
  const filteredByDatastore =
    args.filter === null ? allEntries : allEntries.filter((e) => e.datastore === args.filter);
  const skippedFailed = filteredByDatastore.filter((e) => e.status === "failed");
  const working = filteredByDatastore.filter((e) => e.status !== "failed");
  console.log(
    `Loaded ${allEntries.length} entries; processing ${working.length}` +
      (skippedFailed.length > 0 ? ` (skipping ${skippedFailed.length} status=failed)` : ""),
  );
  for (const skipped of skippedFailed) {
    console.log(
      `  [skip] ${skipped.id}: status=failed (${skipped.lastFailureReason ?? "no reason"})`,
    );
  }

  const { ok, failed } = await fetchAll(working, args.mode);

  if (args.dryRun) {
    printDryRunReport(working, ok, failed);
    return;
  }

  if (args.mode === "fail-fast" && failed.length > 0) {
    console.error(`fail-fast mode aborting with ${failed.length} failures`);
    process.exit(1);
  }

  console.log("");
  console.log("=== Calling Discovery Engine importDocuments ===");
  const client = new DocumentServiceClient();
  let totalSuccess = 0;
  let totalFailed = 0;
  for (const [ds, items] of groupByDataStore(ok)) {
    const result = await importToDataStore(client, ds, items);
    console.log(
      `  [${ds}] success=${result.success} failed=${result.failed} op=${result.operationId}`,
    );
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  if (totalFailed > 0 && args.mode === "fail-fast") {
    console.error(`fail-fast: ${totalFailed} LRO failures — not writing JSONL`);
    process.exit(1);
  }

  console.log("");
  console.log("=== Updating data/source-index.jsonl ===");
  await rewriteIndexWithHashes(allEntries, ok);
  console.log(`Wrote ${allEntries.length} entries, ${ok.length} with new SHA-256.`);
  console.log(`Total import: success=${totalSuccess} failed=${totalFailed}`);
}

main().catch((err) => {
  console.error("");
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});

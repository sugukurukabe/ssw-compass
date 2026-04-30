import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  bucketNames,
  canonicalizeUrl,
  dataStoreForGroup,
  groupForEntry,
  metadataRow,
  mimeFromUrlAndContentType,
  objectNameFor,
  parseArgs,
  readJsonl,
  sha256Hex,
  uploadObject,
} from "./rag-shared.mjs";

const USER_AGENT = "ssw-compass-rag-prepare/1.0 (+https://github.com/sugukurukabe/ssw-compass)";
const ACCEPT_MIME_TYPES = [
  "text/html",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
].join(",");
const FETCH_TIMEOUT_MS = 15_000;
const sourceIndexPath = resolve(process.cwd(), "data/source-index.jsonl");
const formsCatalogPath = resolve(process.cwd(), "data/forms-catalog.jsonl");
const routingPath = resolve(process.cwd(), "data/datastore-routing.json");
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log("Usage: pnpm prepare:rag -- --dry-run --filter=visa_forms --env=prod");
  process.exit(0);
}

const routing = JSON.parse(await readFile(routingPath, "utf-8"));
const buckets = bucketNames(args.env);
const sourceEntries = (await readJsonl(sourceIndexPath)).filter(
  (entry) => entry.status !== "failed",
);
const formEntries = (await readJsonl(formsCatalogPath))
  .filter((entry) => entry.kind === "form_bundle" || entry.kind === "reference_form")
  .map((entry) => ({
    id: `forms-${entry.id}`,
    title: entry.title_ja,
    url: entry.url,
    canonicalUrl: entry.url,
    ministry: "moj",
    datastore: "visa_forms_v2",
    dataStoreGroup: "visa_forms",
    trustLevel: "primary_source",
    sourceType: "official_form",
    tags: [
      "forms",
      entry.kind,
      ...(entry.section !== undefined ? [entry.section] : []),
      ...(entry.referenceNumber !== undefined ? [`ref_${entry.referenceNumber}`] : []),
      ...(entry.industry !== undefined ? [entry.industry] : []),
    ],
    lang: "ja",
    verifiedAt: entry.revisedAt ?? new Date().toISOString().slice(0, 10),
    contentSha256: "UNVERIFIED",
    contentMimeType: entry.url.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : entry.url.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : entry.url.endsWith(".doc")
          ? "application/msword"
          : entry.url.endsWith(".xls")
            ? "application/vnd.ms-excel"
            : "text/html",
    notes: entry.notes,
  }));
const entries = [...sourceEntries, ...formEntries];
const selected =
  args.filter === null ? entries : entries.filter((entry) => groupForEntry(entry) === args.filter);
const accessToken = process.env["GOOGLE_OAUTH_ACCESS_TOKEN"];

if (!args.dryRun && (accessToken === undefined || accessToken.length === 0)) {
  throw new Error("GOOGLE_OAUTH_ACCESS_TOKEN is required unless --dry-run is set");
}

const byStore = new Map();
let fetched = 0;
let failed = 0;

for (const [index, entry] of selected.entries()) {
  const group = groupForEntry(entry);
  const dataStore = dataStoreForGroup(routing, group);
  const canonicalUrl = entry.canonicalUrl ?? canonicalizeUrl(entry.url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    process.stdout.write(`[${index + 1}/${selected.length}] ${entry.id} ${canonicalUrl}... `);
    const response = await fetch(canonicalUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: ACCEPT_MIME_TYPES },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      failed += 1;
      console.log(`FAIL HTTP ${response.status}`);
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = mimeFromUrlAndContentType(
      canonicalUrl,
      response.headers.get("content-type") ?? "",
    );
    const sha = sha256Hex(buffer);
    const objectName = entry.gcsObjectName ?? objectNameFor(entry, sha, mimeType);
    const gcsUri = `gs://${buckets.raw}/${objectName}`;
    const row = metadataRow(entry, gcsUri, mimeType, sha, group);
    if (!byStore.has(dataStore)) byStore.set(dataStore, []);
    byStore.get(dataStore).push(row);
    if (!args.dryRun) {
      await uploadObject(buckets.raw, objectName, buffer, mimeType, accessToken);
    }
    fetched += 1;
    console.log(`OK ${mimeType} ${buffer.length}B -> ${gcsUri}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

for (const [dataStore, rows] of byStore) {
  const objectName = `metadata/${args.runDate}/${dataStore}.ndjson`;
  const body = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const localPath = resolve(
    process.cwd(),
    "data",
    `agent-search-${dataStore}.${args.runDate}.ndjson`,
  );
  await writeFile(localPath, body, "utf-8");
  if (!args.dryRun) {
    await uploadObject(
      buckets.metadata,
      objectName,
      Buffer.from(body),
      "application/x-ndjson",
      accessToken,
    );
  }
  console.log(
    `${args.dryRun ? "DRY-RUN" : "WROTE"} metadata ${dataStore}: ${rows.length} rows -> ${localPath}`,
  );
}

console.log(`prepare complete: fetched=${fetched} failed=${failed} dryRun=${args.dryRun}`);
if (failed > 0) process.exitCode = 1;

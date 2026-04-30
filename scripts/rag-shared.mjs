import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export const PROJECT_ID = process.env["CLOUDSDK_CORE_PROJECT"] ?? "ssw-compass-prod-494613";
export const LOCATION = process.env["SSW_VERTEX_LOCATION"] ?? "asia-northeast1";
export const COLLECTION = process.env["SSW_VERTEX_COLLECTION"] ?? "default_collection";
export const BRANCH = "0";
export const ENDPOINT =
  LOCATION === "global"
    ? "discoveryengine.googleapis.com"
    : `${LOCATION}-discoveryengine.googleapis.com`;

export const DATA_STORE_GROUPS = new Set([
  "visa_legal_core",
  "visa_forms",
  "visa_faq",
  "visa_law_updates",
  "dev_context",
]);

export function parseArgs(argv) {
  const args = {
    dryRun: false,
    filter: null,
    env: "prod",
    runDate: new Date().toISOString().slice(0, 10),
    metadataFile: null,
  };
  for (const raw of argv) {
    if (raw === "--") {
      continue;
    }
    if (raw === "--dry-run") {
      args.dryRun = true;
    } else if (raw.startsWith("--filter=")) {
      args.filter = raw.slice("--filter=".length);
    } else if (raw.startsWith("--env=")) {
      args.env = raw.slice("--env=".length);
    } else if (raw.startsWith("--run-date=")) {
      args.runDate = raw.slice("--run-date=".length);
    } else if (raw.startsWith("--metadata-file=")) {
      args.metadataFile = raw.slice("--metadata-file=".length);
    } else if (raw === "--help" || raw === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${raw}`);
    }
  }
  return args;
}

export async function readJsonl(path) {
  const text = await readFile(path, "utf-8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `${path} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
}

export function canonicalizeUrl(url) {
  const u = new URL(url);
  u.hash = "";
  const dynamicParams = [
    "q",
    "query",
    "search",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "session",
  ];
  for (const key of dynamicParams) {
    u.searchParams.delete(key);
  }
  u.searchParams.sort();
  return u.toString();
}

export function isDynamicUrl(url) {
  const u = new URL(url);
  if (u.hash.length > 0) return true;
  for (const key of u.searchParams.keys()) {
    if (/^(q|query|search|utm_|session|token|preview)/i.test(key)) return true;
  }
  return /\/search\//i.test(u.pathname);
}

export function extensionForMime(mimeType) {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "application/json") return ".json";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return ".docx";
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return ".xlsx";
  if (mimeType === "application/msword") return ".doc";
  if (mimeType === "application/vnd.ms-excel") return ".xls";
  if (mimeType === "text/markdown") return ".md";
  if (mimeType === "text/plain") return ".txt";
  return ".html";
}

export function mimeFromUrlAndContentType(url, contentType) {
  const explicit = contentType.split(";")[0]?.trim();
  if (explicit !== undefined && explicit.length > 0) return explicit;
  const ext = extname(new URL(url).pathname).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".md") return "text/markdown";
  if (ext === ".json") return "application/json";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".doc") return "application/msword";
  if (ext === ".xls") return "application/vnd.ms-excel";
  return "text/html";
}

export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function objectNameFor(entry, sha256, mimeType) {
  const ext = extensionForMime(mimeType);
  return `official/${entry.ministry}/${entry.id}/${sha256}${ext}`;
}

export function bucketNames(env) {
  return {
    raw: `ssw-compass-rag-raw-${env}`,
    metadata: `ssw-compass-rag-metadata-${env}`,
  };
}

export async function uploadObject(bucket, objectName, body, contentType, accessToken) {
  const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("name", objectName);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `GCS upload failed ${bucket}/${objectName}: HTTP ${response.status} ${await response.text()}`,
    );
  }
}

export function groupForEntry(entry) {
  if (entry.dataStoreGroup !== undefined) return entry.dataStoreGroup;
  if (entry.datastore === "visa_faq") return "visa_faq";
  if (entry.tags?.includes("forms") || entry.tags?.includes("reference_form")) return "visa_forms";
  if (entry.tags?.includes("law_update")) return "visa_law_updates";
  return "visa_legal_core";
}

export function dataStoreForGroup(routing, group) {
  const target = routing.groups?.[group]?.dataStoreId;
  if (typeof target !== "string" || target.length === 0) {
    throw new Error(`No dataStoreId configured for group ${group}`);
  }
  return target;
}

export function metadataRow(entry, gcsUri, mimeType, sha256, group) {
  const canonicalUrl = entry.canonicalUrl ?? canonicalizeUrl(entry.url);
  return {
    id: entry.id,
    structData: {
      title: entry.title,
      url: entry.url,
      canonicalUrl,
      ministry: entry.ministry,
      datastore: entry.datastore,
      dataStoreGroup: group,
      trustLevel: entry.trustLevel,
      sourceType: entry.sourceType ?? "official_page",
      lang: entry.lang,
      publishedAt: entry.verifiedAt,
      contentSha256: sha256,
      tags: entry.tags,
    },
    content: {
      mimeType,
      uri: gcsUri,
    },
  };
}

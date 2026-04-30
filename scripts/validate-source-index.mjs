import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalizeUrl, groupForEntry, isDynamicUrl, readJsonl } from "./rag-shared.mjs";

const sourceIndexPath = resolve(process.cwd(), "data/source-index.jsonl");
const routingPath = resolve(process.cwd(), "data/datastore-routing.json");
const strict = process.argv.includes("--strict");

const entries = await readJsonl(sourceIndexPath);
const routing = JSON.parse(await readFile(routingPath, "utf-8"));
const canonicalSeen = new Map();
const failures = [];
const warnings = [];

for (const [index, entry] of entries.entries()) {
  const label = `${entry.id ?? `(line ${index + 1})`}`;
  if (typeof entry.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) {
    failures.push(`${label}: invalid id`);
  }
  if (entry.trustLevel !== "primary_source") {
    failures.push(`${label}: trustLevel must be primary_source`);
  }
  for (const required of [
    "canonicalUrl",
    "dataStoreGroup",
    "sourceType",
    "contentMimeType",
    "chunkProfile",
  ]) {
    if (typeof entry[required] !== "string" || entry[required].length === 0) {
      warnings.push(`${label}: missing ${required}; run pnpm normalize:source-index`);
    }
  }
  if (typeof entry.url !== "string") {
    failures.push(`${label}: missing url`);
    continue;
  }
  if (isDynamicUrl(entry.url)) {
    failures.push(`${label}: dynamic URL is not allowed (${entry.url})`);
  }
  const canonical = entry.canonicalUrl ?? canonicalizeUrl(entry.url);
  const previous = canonicalSeen.get(canonical);
  if (previous !== undefined && previous !== entry.id) {
    warnings.push(`${label}: duplicate canonicalUrl with ${previous}: ${canonical}`);
  }
  canonicalSeen.set(canonical, entry.id);
  const group = groupForEntry(entry);
  if (routing.groups?.[group] === undefined) {
    failures.push(`${label}: unknown dataStoreGroup ${group}`);
  }
}

console.log(`source-index entries: ${entries.length}`);
console.log(`canonical URLs:       ${canonicalSeen.size}`);
console.log(`warnings:             ${warnings.length}`);
console.log(`failures:             ${failures.length}`);

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}
for (const failure of failures) {
  console.error(`FAIL ${failure}`);
}

if (failures.length > 0 || (strict && warnings.length > 0)) {
  process.exit(1);
}

console.log("source-index validation passed.");

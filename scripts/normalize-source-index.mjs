import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canonicalizeUrl,
  groupForEntry,
  isDynamicUrl,
  mimeFromUrlAndContentType,
} from "./rag-shared.mjs";

const path = resolve(process.cwd(), "data/source-index.jsonl");
const text = await readFile(path, "utf-8");
const entries = text
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

function sourceTypeFor(entry) {
  if (entry.tags?.includes("faq")) return "official_faq";
  if (entry.tags?.includes("forms") || entry.tags?.includes("reference_form"))
    return "official_form";
  return "official_page";
}

function chunkProfileFor(entry) {
  if (entry.tags?.includes("faq")) return "structured_boundary";
  return "native_500_heading";
}

const normalized = entries.map((entry) => {
  if (isDynamicUrl(entry.url)) {
    throw new Error(`${entry.id}: dynamic URL cannot be normalized safely: ${entry.url}`);
  }
  return {
    ...entry,
    canonicalUrl: entry.canonicalUrl ?? canonicalizeUrl(entry.url),
    dataStoreGroup: entry.dataStoreGroup ?? groupForEntry(entry),
    sourceType: entry.sourceType ?? sourceTypeFor(entry),
    contentMimeType: entry.contentMimeType ?? mimeFromUrlAndContentType(entry.url, ""),
    chunkProfile: entry.chunkProfile ?? chunkProfileFor(entry),
  };
});

await writeFile(path, `${normalized.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf-8");
console.log(`normalized ${normalized.length} source-index entries`);

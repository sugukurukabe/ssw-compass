import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CANDIDATES_PATH = resolve(process.cwd(), "data/industry-resource-candidates.jsonl");

const INDUSTRY_KEYS = new Set([
  "_global",
  "nursing_care",
  "building_cleaning",
  "industrial_products_manufacturing",
  "construction",
  "shipbuilding",
  "automobile_maintenance",
  "aviation",
  "accommodation",
  "agriculture",
  "fishery",
  "food_manufacturing",
  "food_service",
  "automobile_transportation",
  "railway",
  "forestry",
  "wood_products",
]);

const REQUIRED_INDUSTRIES = [...INDUSTRY_KEYS].filter((key) => key !== "_global");
const CATALOGS = new Set(["source_index", "forms"]);
const MINISTRY_KEYS = new Set(["moj", "mhlw", "meti", "mlit", "maff", "jfa", "rinya"]);
const STATUSES = new Set([undefined, "ok", "failed"]);
const SOURCE_DOCUMENT_TYPES = new Set([
  null,
  "operation_policy",
  "operation_guide",
  "guide_appendix",
  "exam_guide",
]);
const FORM_TYPES = new Set(["table3", "pledge", "certificate", "reference_form"]);
const FILE_TYPES = new Set(["xlsx", "docx", "pdf"]);

function readJsonl(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
}

function isValidUrlOrMissing(value) {
  if (value === "未取得") return true;
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const candidates = readJsonl(await readFile(CANDIDATES_PATH, "utf-8"));
const failures = [];
const warnings = [];
const seen = new Set();
const countsByIndustry = new Map();

for (const [index, item] of candidates.entries()) {
  const label = `line ${index + 1}`;
  if (!CATALOGS.has(item.catalog)) failures.push(`${label}: invalid catalog ${item.catalog}`);
  if (!INDUSTRY_KEYS.has(item.industry_key)) {
    failures.push(`${label}: invalid industry_key ${item.industry_key}`);
  }
  if (typeof item.title !== "string" || item.title.length === 0) {
    failures.push(`${label}: missing title`);
  }
  if (!isValidUrlOrMissing(item.url)) failures.push(`${label}: invalid url ${item.url}`);
  if (item.url === "未取得") warnings.push(`${label}: url is 未取得`);
  if (!MINISTRY_KEYS.has(item.ministry_key)) {
    failures.push(`${label}: invalid ministry_key ${item.ministry_key}`);
  }
  if (item.revised_at !== null && typeof item.revised_at !== "string") {
    failures.push(`${label}: revised_at must be null or string`);
  }
  if (!STATUSES.has(item.status)) failures.push(`${label}: invalid status ${item.status}`);
  if (item.status === "failed" && typeof item.lastFailureReason !== "string") {
    failures.push(`${label}: failed item requires lastFailureReason`);
  }

  const key = `${item.catalog}:${item.industry_key}:${item.url}:${item.title}`;
  if (seen.has(key)) warnings.push(`${label}: duplicate item ${key}`);
  seen.add(key);

  const counts = countsByIndustry.get(item.industry_key) ?? { source: 0, forms: 0 };
  if (item.catalog === "source_index") {
    counts.source += 1;
    if (!SOURCE_DOCUMENT_TYPES.has(item.document_type ?? null)) {
      failures.push(`${label}: invalid document_type ${item.document_type}`);
    }
  } else if (item.catalog === "forms") {
    counts.forms += 1;
    if (!FORM_TYPES.has(item.form_type))
      failures.push(`${label}: invalid form_type ${item.form_type}`);
    if (!FILE_TYPES.has(item.file_type))
      failures.push(`${label}: invalid file_type ${item.file_type}`);
  }
  countsByIndustry.set(item.industry_key, counts);
}

for (const industry of REQUIRED_INDUSTRIES) {
  const counts = countsByIndustry.get(industry);
  if (counts === undefined) {
    failures.push(`${industry}: no candidates`);
    continue;
  }
  if (counts.source === 0) failures.push(`${industry}: no source_index candidates`);
  if (counts.forms === 0) failures.push(`${industry}: no forms candidates`);
}

console.log(`industry-resource candidates: ${candidates.length}`);
console.log(`warnings:                    ${warnings.length}`);
console.log(`failures:                    ${failures.length}`);

for (const [industry, counts] of [...countsByIndustry.entries()].sort()) {
  console.log(`${industry}: source=${counts.source} forms=${counts.forms}`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);

if (failures.length > 0) process.exit(1);

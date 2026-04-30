import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { canonicalizeUrl, readJsonl } from "./rag-shared.mjs";

const RUN_DATE = "2026-05-01";
const CANDIDATES_PATH = resolve(process.cwd(), "data/industry-resource-candidates.jsonl");
const SOURCE_INDEX_PATH = resolve(process.cwd(), "data/source-index.jsonl");
const FORMS_CATALOG_PATH = resolve(process.cwd(), "data/forms-catalog.jsonl");
const FORMS_REFERENCE_PAGE = "https://www.moj.go.jp/isa/applications/ssw/10_00020.html";
const TABLE3_REFERENCE_PAGE =
  "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html";

const PURPOSE_TAGS = {
  分野トップ: "industry_top",
  資料一覧: "reference",
  試験: "exam",
  "試験・協議会": "exam",
};

function sha(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function sourceTypeFor(candidate) {
  if (typeof candidate.document_type === "string" && candidate.document_type.length > 0) {
    return candidate.document_type;
  }
  if (candidate.purpose === "試験") return "official_exam_site";
  if (candidate.purpose === "分野トップ") return "official_page";
  return "official_page";
}

function contentMimeType(url) {
  const ext = extname(new URL(url).pathname).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/html";
}

function sourceId(candidate) {
  const industry =
    candidate.industry_key === "_global" ? "global" : candidate.industry_key.replaceAll("_", "-");
  return `ssw-${industry}-${sourceTypeFor(candidate).replaceAll("_", "-")}-${sha(candidate.url)}`;
}

function sourceTags(candidate) {
  const tags = ["ssw_1"];
  if (candidate.industry_key !== "_global") tags.push(candidate.industry_key);
  const sourceType = sourceTypeFor(candidate);
  tags.push(sourceType);
  if (sourceType === "official_exam_site") tags.push("delegated_official");
  const purposeTag = PURPOSE_TAGS[candidate.purpose];
  if (purposeTag !== undefined) tags.push(purposeTag);
  if (candidate.document_type !== null && candidate.document_type !== undefined) {
    tags.push(candidate.document_type);
  }
  return [...new Set(tags)];
}

function toSourceIndexEntry(candidate) {
  return {
    id: sourceId(candidate),
    title: candidate.title,
    url: candidate.url,
    ministry: candidate.ministry_key,
    datastore: "visa_legal",
    trustLevel: "primary_source",
    tags: sourceTags(candidate),
    lang: "ja",
    verifiedAt: RUN_DATE,
    contentSha256: "UNVERIFIED",
    notes: candidate.notes,
    status: candidate.status ?? "ok",
    ...(candidate.lastFailureReason !== undefined
      ? { lastFailureReason: candidate.lastFailureReason }
      : {}),
    lastRunAt: RUN_DATE,
    canonicalUrl: canonicalizeUrl(candidate.url),
    dataStoreGroup: "visa_legal_core",
    sourceType: sourceTypeFor(candidate),
    contentMimeType: contentMimeType(candidate.url),
    chunkProfile: "native_500_heading",
  };
}

function normalizeReferenceNumber(title) {
  const ascii = title.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
  const match = ascii.match(/第\s*([0-9]+)\s*[－-]\s*([0-9]+)\s*号/);
  if (match?.[1] !== undefined && match[2] !== undefined) return `${match[1]}-${match[2]}`;
  return `unknown-${sha(title)}`;
}

function formId(candidate) {
  if (candidate.form_type === "table3") return `ssw1-${candidate.industry_key}-table3`;
  return `ref-sector-${candidate.industry_key}-${normalizeReferenceNumber(candidate.title)}-${
    candidate.file_type
  }`;
}

function toFormEntry(candidate) {
  if (candidate.form_type === "table3") {
    return {
      id: formId(candidate),
      kind: "form_bundle",
      procedure: "all",
      sswLevel: "i",
      section: "table3",
      industry: candidate.industry_key,
      title_ja: candidate.title,
      officialReferencePage: TABLE3_REFERENCE_PAGE,
      url: candidate.url,
      revisedAt: RUN_DATE,
      stability: "unstable_content_url",
      notes: candidate.notes,
    };
  }
  return {
    id: formId(candidate),
    kind: "reference_form",
    referenceNumber: normalizeReferenceNumber(candidate.title),
    title_ja: candidate.title,
    url: candidate.url,
    officialReferencePage: FORMS_REFERENCE_PAGE,
    stability: "stable_content_url",
    appliesTo: [`industry:${candidate.industry_key}`, candidate.form_type],
    notes: candidate.notes,
  };
}

function mergeById(existing, additions) {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of additions) byId.set(entry.id, entry);
  return [...byId.values()];
}

function mergeSources(existing, additions) {
  const byCanonical = new Map(
    existing.map((entry) => [canonicalizeUrl(entry.canonicalUrl ?? entry.url), entry]),
  );
  for (const entry of additions) {
    const key = canonicalizeUrl(entry.canonicalUrl ?? entry.url);
    const previous = byCanonical.get(key);
    if (previous === undefined) {
      byCanonical.set(key, entry);
      continue;
    }
    byCanonical.set(key, {
      ...entry,
      tags: [...new Set([...(previous.tags ?? []), ...(entry.tags ?? [])])],
      notes: [previous.notes, entry.notes].filter(Boolean).join(" / "),
    });
  }
  return [...byCanonical.values()];
}

const candidates = await readJsonl(CANDIDATES_PATH);
const sourceCandidates = candidates.filter((entry) => entry.catalog === "source_index");
const formCandidates = candidates.filter((entry) => entry.catalog === "forms");

const existingSources = await readJsonl(SOURCE_INDEX_PATH);
const existingForms = await readJsonl(FORMS_CATALOG_PATH);

const sourceAdditions = sourceCandidates.map(toSourceIndexEntry);
const formAdditions = formCandidates.map(toFormEntry);

const mergedSources = mergeSources(existingSources, sourceAdditions);
const mergedForms = mergeById(existingForms, formAdditions);

await writeFile(
  SOURCE_INDEX_PATH,
  `${mergedSources.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
);
await writeFile(
  FORMS_CATALOG_PATH,
  `${mergedForms.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
);

console.log(`source-index: ${existingSources.length} -> ${mergedSources.length}`);
console.log(`forms-catalog: ${existingForms.length} -> ${mergedForms.length}`);

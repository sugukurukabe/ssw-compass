import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJsonl } from "./rag-shared.mjs";

const FORMS_CATALOG_PATH = resolve(process.cwd(), "data/forms-catalog.jsonl");
const SOURCE_PAGE = "https://www.moj.go.jp/isa/applications/ssw/10_00020.html";
const LANGUAGES = ["en", "vi", "tl", "id", "th", "my", "km", "mn", "ne", "zh"];

const wordUrls = {
  en: "https://www.moj.go.jp/isa/content/001339716.docx",
  vi: "https://www.moj.go.jp/isa/content/001339719.docx",
  tl: "https://www.moj.go.jp/isa/content/001339722.docx",
  id: "https://www.moj.go.jp/isa/content/001339725.docx",
  th: "https://www.moj.go.jp/isa/content/001443715.docx",
  my: "https://www.moj.go.jp/isa/content/001449920.docx",
  km: "https://www.moj.go.jp/isa/content/001339735.docx",
  mn: "https://www.moj.go.jp/isa/content/001339738.docx",
  ne: "https://www.moj.go.jp/isa/content/001339741.docx",
  zh: "https://www.moj.go.jp/isa/content/001339744.docx",
};

const excelUrls = {
  en: "https://www.moj.go.jp/isa/content/001339717.xlsx",
  vi: "https://www.moj.go.jp/isa/content/001339720.xlsx",
  tl: "https://www.moj.go.jp/isa/content/001339723.xls",
  id: "https://www.moj.go.jp/isa/content/001339726.xls",
  th: "https://www.moj.go.jp/isa/content/001339729.xls",
  my: "https://www.moj.go.jp/isa/content/001417782.xls",
  km: "https://www.moj.go.jp/isa/content/001339736.xls",
  mn: "https://www.moj.go.jp/isa/content/001339739.xls",
  ne: "https://www.moj.go.jp/isa/content/001339742.xls",
  zh: "https://www.moj.go.jp/isa/content/001339745.xls",
};

const pdfUrls = {
  my: "https://www.moj.go.jp/isa/content/001449921.pdf",
};

const multilingual = {
  applicantUnderstandingRequired: true,
  translationsAvailable: true,
  sourcePage: SOURCE_PAGE,
  languages: LANGUAGES,
  wordUrls,
  excelUrls,
  pdfUrls,
  variableDataNote:
    "英語版は可変データについて参考様式第1-13号及び第1-17号のみEXCEL、それ以外はWORD。9か国語版は可変データについて参考様式第1-13号のみEXCEL、それ以外はWORD。",
};

const TARGET_REFERENCE_NUMBERS = new Set([
  "1-3",
  "1-5",
  "1-6",
  "1-10",
  "1-13",
  "1-16",
  "1-17",
  "5-7",
  "5-8",
  "5-9",
]);

const missingBaseForms = [
  {
    id: "ref-1-10-skill-transfer-statement",
    referenceNumber: "1-10",
    title_ja: "技能移転に係る申告書",
    url: "https://www.moj.go.jp/isa/content/001338979.docx",
    appliesTo: ["all_applicants"],
    notes: "申請人本人の理解・署名が特に必要な様式として英語及び9か国語版の対象。",
  },
  {
    id: "ref-1-16-employment-background",
    referenceNumber: "1-16",
    title_ja: "雇用の経緯に係る説明書",
    url: "https://www.moj.go.jp/isa/content/001338986.docx",
    appliesTo: ["all_applicants"],
    notes: "申請人本人の理解・署名が特に必要な様式として英語及び9か国語版の対象。",
  },
  {
    id: "ref-5-7-remuneration-payment-certificate",
    referenceNumber: "5-7",
    title_ja: "報酬支払証明書",
    url: "https://www.moj.go.jp/isa/content/001340546.doc",
    ingestUrl: SOURCE_PAGE,
    appliesTo: ["periodic_or_ad_hoc_notification"],
    notes:
      "申請人本人の理解・署名が特に必要な様式として英語及び9か国語版の対象。DOC直リンクはAgent Searchのcontent.mime_type許可外のため、RAG取り込みは掲載元ページを使用する。",
  },
  {
    id: "ref-5-8-life-orientation-confirmation",
    referenceNumber: "5-8",
    title_ja: "生活オリエンテーションの確認書",
    url: "https://www.moj.go.jp/isa/content/001340547.docx",
    appliesTo: ["support_implementation"],
    notes: "申請人本人の理解・署名が特に必要な様式として英語及び9か国語版の対象。",
  },
  {
    id: "ref-5-9-pre-guidance-confirmation",
    referenceNumber: "5-9",
    title_ja: "事前ガイダンスの確認書",
    url: "https://www.moj.go.jp/isa/content/001341755.docx",
    appliesTo: ["support_implementation"],
    notes: "申請人本人の理解・署名が特に必要な様式として英語及び9か国語版の対象。",
  },
];

function annotate(entry) {
  if (entry.kind !== "reference_form") return entry;
  if (!TARGET_REFERENCE_NUMBERS.has(entry.referenceNumber)) return entry;
  return {
    ...entry,
    appliesTo: [
      ...new Set([
        ...entry.appliesTo,
        "applicant_understanding_required",
        "multilingual_template_available",
      ]),
    ],
    multilingual,
    notes: entry.notes.includes("英語及び9か国語版")
      ? entry.notes
      : `${entry.notes} 申請人本人に特に理解いただいた上で署名が必要な様式として、英語及び9か国語版の対象。`,
  };
}

const entries = (await readJsonl(FORMS_CATALOG_PATH)).map(annotate);
const byId = new Map(entries.map((entry) => [entry.id, entry]));

for (const form of missingBaseForms) {
  byId.set(form.id, {
    kind: "reference_form",
    officialReferencePage: SOURCE_PAGE,
    stability: "stable_content_url",
    multilingual,
    ...form,
    appliesTo: [
      ...new Set([
        ...form.appliesTo,
        "applicant_understanding_required",
        "multilingual_template_available",
      ]),
    ],
  });
}

await writeFile(
  FORMS_CATALOG_PATH,
  `${[...byId.values()].map((entry) => JSON.stringify(entry)).join("\n")}\n`,
);

console.log(`forms-catalog multilingual metadata merged: ${byId.size} entries`);

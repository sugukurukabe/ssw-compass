import { z } from "zod";

/**
 * list_visa_documents — enumerates documents commonly required for a given
 * Japanese SSW-class visa procedure.
 *
 * Sprint 2 Batch 5 fixture is deliberately narrow: `tokutei_ginou_1` with
 * `agriculture` industry returns the 7 most commonly cited documents
 * (contract, application form, résumé, skill test certificate, Japanese test
 * certificate, support plan, pledge). Other industries fall back to the
 * industry-agnostic 5-item baseline (contract, application form, résumé,
 * support plan, pledge). Batch 6 will replace the catalog with
 * gyoseishoshi-reviewed content per-industry.
 */

export const DOCUMENT_CATEGORY = ["required", "conditional", "supporting"] as const;
export const DOCUMENT_STATUS = [
  "required",
  "omitted_due_to_category",
  "applicant_specific",
  "sector_specific",
] as const;

export const DOCUMENTS_VISA_CATEGORY = [
  "tokutei_ginou_1",
  "tokutei_ginou_2",
  "ginou_jisshu",
  "tokutei_katsudo",
  "gijinkoku",
  "kazokutaizai",
  "other",
] as const;

export const DOCUMENTS_INDUSTRY = [
  "agriculture",
  "fishery",
  "food_manufacturing",
  "food_service",
  "manufacturing",
  "industrial_products_manufacturing",
  "construction",
  "nursing_care",
  "building_cleaning",
  "automobile_repair",
  "automobile_maintenance",
  "aviation",
  "lodging",
  "accommodation",
  "shipbuilding",
  "electronics",
  "automobile_transportation",
  "railway",
  "forestry",
  "wood_products",
  "other",
] as const;

export const ListVisaDocumentsInput = z
  .object({
    visaCategory: z.enum(DOCUMENTS_VISA_CATEGORY).describe("対象の在留資格"),
    industry: z
      .enum(DOCUMENTS_INDUSTRY)
      .optional()
      .describe("特定技能の対象産業分野 (省略時は分野非依存の書類のみ)"),
    language: z.enum(["ja", "en", "id"]).default("ja"),
  })
  .strict();
export type ListVisaDocumentsInput = z.infer<typeof ListVisaDocumentsInput>;

export const DocumentEntry = z.object({
  id: z.string().describe("UI 側でチェック状態を管理する安定キー"),
  label: z.object({ ja: z.string(), en: z.string(), id: z.string() }),
  description: z.string(),
  category: z.enum(DOCUMENT_CATEGORY),
  status: z.enum(DOCUMENT_STATUS).default("required"),
  group: z.enum(["table1", "table2", "table3", "reference_form", "omission"]).default("table1"),
  ministry: z.string().optional(),
  trustLevel: z.enum(["primary_source", "secondary", "community"]),
  sourceUrl: z.string().url().optional(),
  applicantUnderstandingRequired: z.boolean().optional(),
  multilingualTemplateAvailable: z.boolean().optional(),
  multilingualSourceUrl: z.string().url().optional(),
});
export type DocumentEntry = z.input<typeof DocumentEntry>;

export const ListVisaDocumentsOutput = z.object({
  documents: z.array(DocumentEntry),
  disclaimer: z.string(),
  asOf: z.string(),
});
export type ListVisaDocumentsOutput = z.infer<typeof ListVisaDocumentsOutput>;

export type DocumentCategory = (typeof DOCUMENT_CATEGORY)[number];

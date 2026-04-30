import { z } from "zod";
import { DOCUMENTS_INDUSTRY } from "./list-visa-documents.js";

const DocumentsIndustry = z.enum(DOCUMENTS_INDUSTRY);

export const FormProcedure = z.enum(["coe", "change", "renewal", "all"]);
export type FormProcedure = z.infer<typeof FormProcedure>;

export const SswLevel = z.enum(["i", "ii"]);
export type SswLevel = z.infer<typeof SswLevel>;

export const FormSection = z.enum(["table1", "table2_1", "table2_2", "table2_3", "table3"]);
export type FormSection = z.infer<typeof FormSection>;

export const ReceivingOrganizationProfile = z.enum([
  "same_fiscal_year_repeat",
  "table2_1_eligible",
  "corporation",
  "sole_proprietor",
  "not_applicable",
]);
export type ReceivingOrganizationProfile = z.infer<typeof ReceivingOrganizationProfile>;

export const ApplicantProfile = z.enum([
  "technical_intern_2_same_field",
  "technical_intern_2_different_field",
  "no_exemption",
  "sector_exception",
]);
export type ApplicantProfile = z.infer<typeof ApplicantProfile>;

export const FormsCatalogEntryKind = z.enum([
  "form_bundle",
  "reference_form",
  "receiving_organization_profile",
  "applicant_profile",
]);
export type FormsCatalogEntryKind = z.infer<typeof FormsCatalogEntryKind>;

export const TranslationLanguage = z.enum([
  "en",
  "vi",
  "tl",
  "id",
  "th",
  "my",
  "km",
  "mn",
  "ne",
  "zh",
]);
export type TranslationLanguage = z.infer<typeof TranslationLanguage>;

export const MultilingualFormMetadata = z
  .object({
    applicantUnderstandingRequired: z.boolean(),
    translationsAvailable: z.boolean(),
    sourcePage: z.string().url(),
    languages: z.array(TranslationLanguage).min(1),
    wordUrls: z.record(TranslationLanguage, z.string().url()).optional(),
    excelUrls: z.record(TranslationLanguage, z.string().url()).optional(),
    pdfUrls: z.record(TranslationLanguage, z.string().url()).optional(),
    variableDataNote: z.string().min(1),
  })
  .strict();
export type MultilingualFormMetadata = z.infer<typeof MultilingualFormMetadata>;

export const FormBundleCatalogEntry = z
  .object({
    id: z.string().min(1),
    kind: z.literal("form_bundle"),
    procedure: FormProcedure,
    sswLevel: SswLevel,
    section: FormSection,
    industry: z.union([DocumentsIndustry, z.literal("all")]),
    title_ja: z.string().min(1),
    officialReferencePage: z.string().url(),
    url: z.string().url(),
    revisedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    stability: z.enum(["stable_content_url", "unstable_content_url"]),
    notes: z.string().min(1),
  })
  .strict();
export type FormBundleCatalogEntry = z.infer<typeof FormBundleCatalogEntry>;

export const ReferenceFormCatalogEntry = z
  .object({
    id: z.string().min(1),
    kind: z.literal("reference_form"),
    referenceNumber: z.string().min(1),
    title_ja: z.string().min(1),
    url: z.string().url(),
    ingestUrl: z.string().url().optional(),
    officialReferencePage: z.string().url(),
    stability: z.literal("stable_content_url"),
    appliesTo: z.array(z.string().min(1)).min(1),
    multilingual: MultilingualFormMetadata.optional(),
    notes: z.string().min(1),
  })
  .strict();
export type ReferenceFormCatalogEntry = z.infer<typeof ReferenceFormCatalogEntry>;

export const ReceivingOrganizationProfileCatalogEntry = z
  .object({
    id: z.string().min(1),
    kind: z.literal("receiving_organization_profile"),
    profile: ReceivingOrganizationProfile.exclude(["not_applicable"]),
    title_ja: z.string().min(1),
    result: z.enum(["table2_omitted", "table2_1", "table2_2", "table2_3"]),
    requiredSections: z.array(FormSection).min(1),
    omittedSections: z.array(FormSection),
    notes: z.string().min(1),
  })
  .strict();
export type ReceivingOrganizationProfileCatalogEntry = z.infer<
  typeof ReceivingOrganizationProfileCatalogEntry
>;

export const ApplicantProfileCatalogEntry = z
  .object({
    id: z.string().min(1),
    kind: z.literal("applicant_profile"),
    profile: ApplicantProfile,
    title_ja: z.string().min(1),
    testRequirement: z.enum([
      "skills_and_japanese_exempt",
      "japanese_exempt_skills_required",
      "skills_and_japanese_required",
      "sector_specific",
    ]),
    requiredEvidence: z.array(z.string().min(1)).min(1),
    notes: z.string().min(1),
  })
  .strict();
export type ApplicantProfileCatalogEntry = z.infer<typeof ApplicantProfileCatalogEntry>;

export const FormsCatalogEntry = z.discriminatedUnion("kind", [
  FormBundleCatalogEntry,
  ReferenceFormCatalogEntry,
  ReceivingOrganizationProfileCatalogEntry,
  ApplicantProfileCatalogEntry,
]);
export type FormsCatalogEntry = z.infer<typeof FormsCatalogEntry>;

export const FormBundle = z
  .object({
    procedure: z.enum(["coe", "change", "renewal"]),
    sswLevel: SswLevel,
    receivingOrganizationProfile: ReceivingOrganizationProfile,
    applicantProfile: ApplicantProfile,
    industry: DocumentsIndustry,
    requiredSections: z.array(FormSection).min(1),
    omittedSections: z.array(FormSection),
    officialReferencePage: z.literal(
      "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
    ),
  })
  .strict();
export type FormBundle = z.infer<typeof FormBundle>;

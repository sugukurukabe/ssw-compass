import { z } from "zod";
import { FormBundle } from "./forms-catalog.js";
import { SUPPORTED_LANGUAGES } from "./i18n/supported-languages.js";

/**
 * classify_procedure — determines which Japanese visa procedure type applies
 * to a (currentStatus, targetStatus, location) combination.
 *
 * `industry` is optional and does NOT affect the decision tree in Sprint 2.
 * It is carried through so that Sprint 3+ can branch `rationale` / `nextSteps`
 * and grounding `references` by SSW industry sector (農業 uses MAFF 運用要領,
 * 介護 uses MHLW, etc.). Adding the field now avoids a schema-breaking change
 * when the branching lands.
 */

export const CLASSIFY_CURRENT_STATUS = [
  "no_status",
  "tokutei_ginou_1",
  "tokutei_ginou_2",
  "ginou_jisshu_1",
  "ginou_jisshu_2",
  "ginou_jisshu_3",
  "gijinkoku",
  "kazokutaizai",
  "tokutei_katsudo",
  "other",
] as const;

export const CLASSIFY_TARGET_STATUS = [
  "tokutei_ginou_1",
  "tokutei_ginou_2",
  "gijinkoku",
  "kazokutaizai",
  "other",
] as const;

export const CLASSIFY_INDUSTRY = [
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

export const CLASSIFY_PROCEDURE_TYPE = [
  "ninte_shoumeisho_koufu",
  "zairyu_shikaku_henko",
  "zairyu_kikan_koshin",
  "tokutei_katsudo_bridge",
  "not_applicable",
] as const;

export const ClassifyProcedureInput = z
  .object({
    currentStatus: z.enum(CLASSIFY_CURRENT_STATUS).describe("現在の在留資格"),
    targetStatus: z.enum(CLASSIFY_TARGET_STATUS).describe("希望する新しい在留資格"),
    location: z.enum(["japan", "overseas"]).describe("現在の所在地"),
    industry: z
      .enum(CLASSIFY_INDUSTRY)
      .optional()
      .describe("特定技能の対象産業分野 (任意、Sprint 3+ で分野別回答に使用)"),
    yearMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .describe("入国・申請予定の年月 (YYYY-MM 形式、任意)"),
    language: z.enum(SUPPORTED_LANGUAGES).default("ja").describe("出力言語"),
  })
  .strict();
export type ClassifyProcedureInput = z.infer<typeof ClassifyProcedureInput>;

export const ProcedureLabelByLang = z.object({
  ja: z.string(),
  en: z.string(),
  id: z.string(),
});

export const ClassifyProcedureOutput = z.object({
  procedureType: z.enum(CLASSIFY_PROCEDURE_TYPE),
  procedureLabel: ProcedureLabelByLang,
  rationale: z.string(),
  nextSteps: z.array(z.string()),
  formBundle: FormBundle.optional(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  references: z.array(
    z.object({
      title: z.string(),
      sourceUrl: z.string().url(),
      sourceType: z.literal("primary_source"),
      sourceDate: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  disclaimer: z.string(),
  asOf: z.string(),
});
export type ClassifyProcedureOutput = z.infer<typeof ClassifyProcedureOutput>;

export type ClassifyProcedureType = (typeof CLASSIFY_PROCEDURE_TYPE)[number];

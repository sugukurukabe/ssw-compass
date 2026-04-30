import { z } from "zod";

/**
 * get_deadline_timeline — returns statutory deadline milestones for Japanese
 * SSW-class visa holders.
 *
 * PII posture:
 * - `referenceYearMonth` accepts YYYY-MM only; daily precision (YYYY-MM-DD)
 *   is rejected by the schema to keep the tool compatible with v2 §11.3
 *   "year-month only" policy.
 * - No name / card number / passport number field exists in this schema.
 */

export const DEADLINE_KIND = [
  "notification_14days",
  "annual_report",
  "renewal_earliest",
  "tokutei_ginou_1_cap",
  "bridge_preparation",
] as const;

export const TIMELINE_VISA_CATEGORY = [
  "tokutei_ginou_1",
  "tokutei_ginou_2",
  "ginou_jisshu",
  "tokutei_katsudo",
  "gijinkoku",
  "kazokutaizai",
  "other",
] as const;

export const TIMELINE_EVENT_CONTEXT = [
  "contract_start",
  "contract_end",
  "employment_contract_change",
  "support_plan_change",
  "organization_change",
  "regular_report",
  "status_renewal",
  "first_entry",
  "bridge_transition",
  "general",
] as const;

export const TRUST_LEVEL = ["primary_source", "secondary", "community"] as const;

export const GetDeadlineTimelineInput = z
  .object({
    visaCategory: z.enum(TIMELINE_VISA_CATEGORY).describe("対象の在留資格"),
    eventContext: z
      .enum(TIMELINE_EVENT_CONTEXT)
      .default("general")
      .describe("対象事由 (省略時は general = 一般ルールのみ)"),
    referenceYearMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .describe(
        "基準年月 (YYYY-MM 形式)。更新申請の最早期 (3 ヶ月前) 等の相対計算に使用。" +
          "省略時は相対ラベルのみ返す。",
      ),
    language: z
      .enum(["ja", "en", "id"])
      .default("ja")
      .describe("出力言語: 日本語/英語/インドネシア語"),
  })
  .strict();
export type GetDeadlineTimelineInput = z.infer<typeof GetDeadlineTimelineInput>;

export const DeadlineEntry = z.object({
  kind: z.enum(DEADLINE_KIND),
  label: z.object({ ja: z.string(), en: z.string(), id: z.string() }),
  description: z.string(),
  relativeLabel: z.object({ ja: z.string(), en: z.string(), id: z.string() }),
  dueBy: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .describe("計算可能な場合の期限年月 (YYYY-MM)"),
  relatedForms: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        sourceUrl: z.string().url(),
      }),
    )
    .optional(),
  trustLevel: z.enum(TRUST_LEVEL),
});
export type DeadlineEntry = z.infer<typeof DeadlineEntry>;

export const GetDeadlineTimelineOutput = z.object({
  deadlines: z.array(DeadlineEntry),
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
export type GetDeadlineTimelineOutput = z.infer<typeof GetDeadlineTimelineOutput>;

export type DeadlineKind = (typeof DEADLINE_KIND)[number];
export type TrustLevel = (typeof TRUST_LEVEL)[number];

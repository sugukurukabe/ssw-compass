/**
 * validate_zairyu_compatibility ツールの入出力スキーマ (v4 §2.4 H06 / sprint-4-plan §3.8)
 * Input/output schema for validate_zairyu_compatibility tool
 * Skema input/output untuk alat validate_zairyu_compatibility
 *
 * Interface Freeze (sprint-4-plan §3.8): Sprint 4 全期間で不変。
 * legalLevel: L1 (Free OK)
 * H06_ILLEGAL_WORK_ALERT: ILLEGAL 判定時は escalate_to_gyoseishoshi=true を返す。
 */

import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { SSW_INDUSTRIES_ACTIVE } from "../ssw-industries.js";

export const ValidateZairyuCompatibilityInput = z
  .object({
    /** 在留資格ステータス */
    zairyu_status: z.enum([
      "tokutei_ginou_1", // 特定技能1号
      "tokutei_ginou_2", // 特定技能2号
      "ginou_jisshu", // 技能実習
      "gijinkoku", // 技術・人文知識・国際業務
      "kazoku_taizai", // 家族滞在
      "ryugaku", // 留学
      "shokuro_taishi", // 特定活動(就労)
      "other",
    ]),
    /** 在留資格のサブカテゴリ (例: "農業/耕種") */
    zairyu_status_subcategory: z.string().max(100).optional(),
    /** 従事予定の特定技能分野 */
    intended_industry: z.enum(SSW_INDUSTRIES_ACTIVE),
    /** 従事予定の業務内容 */
    intended_task: z.string().min(1).max(200),
    /** 在留期限 (YYYY-MM-DD) */
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** 出力言語 */
    language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
  })
  .strict();
export type ValidateZairyuCompatibilityInput = z.infer<typeof ValidateZairyuCompatibilityInput>;

export const ValidateZairyuCompatibilityOutput = z
  .object({
    /** 判定結果 */
    compatibility: z.enum(["OK", "WARNING", "ILLEGAL"]),
    /** 根拠条文 */
    legal_basis: z.array(z.string()),
    /** 推奨アクション */
    recommended_action: z.string(),
    /** 行政書士相談が必要か */
    escalate_to_gyoseishoshi: z.boolean(),
    /** 免責事項 */
    disclaimer: z.string(),
  })
  .strict();
export type ValidateZairyuCompatibilityOutput = z.infer<typeof ValidateZairyuCompatibilityOutput>;

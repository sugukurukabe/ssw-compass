/**
 * get_deadline_timeline v4 拡張 inputSchema (v4 §3.5 / sprint-4-plan §3.8)
 * v4 extension of get_deadline_timeline inputSchema
 * Ekstensi v4 dari inputSchema get_deadline_timeline
 *
 * Interface Freeze (sprint-4-plan §3.8): Sprint 4 全期間で不変。
 * v3 GetDeadlineTimelineInput フィールドを破壊しない (.extend() パターン)。
 *
 * Free tier 制限 (v4 §3.5):
 * - cases 配列の長さが 3 を超える場合は TierLimitError を throw。
 * - cases は v4 §3.5 で追加。v3 には存在しない (optional で後方互換)。
 */

import { z } from "zod";
import { GetDeadlineTimelineInput } from "../get-deadline-timeline.js";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";

export const GetDeadlineTimelineInputV4 = GetDeadlineTimelineInput.extend({
  /**
   * 出力言語 (v3: ja/en/id → v4: 10言語)
   */
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),

  /**
   * 在留期限を監視するケースの一覧 (v4 §3.5 — 在留期限ダッシュボード)
   * Free tier: 最大 3 件。Pro tier: 最大 30 件。Business tier: 無制限。
   * v3 では存在しない (optional で後方互換)。
   */
  cases: z
    .array(
      z.object({
        case_id: z.string().min(1).max(128),
        expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        application_type: z.string().min(1).max(50),
      }),
    )
    .optional()
    .describe("監視対象ケース一覧 (在留期限ダッシュボード用)"),

  /**
   * アラートを発生させる残日数の閾値 (昇順ソート)
   * default: [14, 30, 60, 90]
   */
  alert_thresholds_days: z
    .array(z.number().int().positive())
    .default([14, 30, 60, 90])
    .describe("アラートを発生させる残日数の閾値 (例: [14, 30, 60, 90])"),

  /**
   * 出力形式
   * gantt_svg: SVG ガントチャート (default)
   * table: テーブル形式
   * json: 構造化 JSON のみ
   */
  visualization: z
    .enum(["gantt_svg", "table", "json"])
    .default("gantt_svg")
    .describe("出力フォーマット"),
}).strict();
export type GetDeadlineTimelineInputV4 = z.infer<typeof GetDeadlineTimelineInputV4>;

/** Free tier の cases 上限数 */
export const FREE_TIER_CASES_LIMIT = 3;
/** Pro tier の cases 上限数 */
export const PRO_TIER_CASES_LIMIT = 30;

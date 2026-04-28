/**
 * list_visa_documents v4 拡張 inputSchema (v4 §3.3 / ADR-020 / sprint-4-plan §3.8)
 * v4 extension of list_visa_documents inputSchema
 * Ekstensi v4 dari inputSchema list_visa_documents
 *
 * Interface Freeze (sprint-4-plan §3.8 / ADR-014 §Per-call escalation):
 * output_format が pdf_draft / csv の場合は effectiveLegalLevel() = "L2" に escalate する。
 * 詳細は ADR-020 を参照。
 */

import { z } from "zod";
import type { LegalLevel } from "../hitl/HitlControl.js";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { ListVisaDocumentsInput } from "../list-visa-documents.js";

/**
 * 出力形式
 * Output format
 * Format keluaran
 */
export const DocumentOutputFormat = z.enum([
  "json", // 構造化 JSON (デフォルト、Free OK)
  "html_preview", // ウォーターマーク入り HTML プレビュー (Free OK)
  "pdf_draft", // PDF ドラフト (Pro+ + gyoseishoshi, ADR-020 §L2 escalation)
  "csv", // オンライン申請 CSV (Pro+ + gyoseishoshi, ADR-020 §L2 escalation)
]);
export type DocumentOutputFormat = z.infer<typeof DocumentOutputFormat>;

export const ListVisaDocumentsInputV4 = ListVisaDocumentsInput.extend({
  /** 省略条件を適用するか (default: true) */
  include_omission_conditions: z
    .boolean()
    .default(true)
    .describe("省略条件を適用して書類数を削減する"),

  /**
   * 出力形式 (ADR-020)
   * pdf_draft / csv は L2 escalation → Pro+gyoseishoshi 必須
   */
  output_format: DocumentOutputFormat.default("json"),

  /** 出力言語 (v4 10言語対応) */
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
}).strict();
export type ListVisaDocumentsInputV4 = z.infer<typeof ListVisaDocumentsInputV4>;

/**
 * ADR-014 §Per-call escalation: output_format から実効 legalLevel を決定する純粋関数。
 * ネットワーク呼び出し・DB 参照をしない (ADR-014 制約)。
 *
 * Pure function determining effective legalLevel from output_format.
 * Must not make network calls or DB reads (ADR-014 constraint).
 */
export function effectiveLegalLevel(
  input: Pick<ListVisaDocumentsInputV4, "output_format">,
): LegalLevel {
  return input.output_format === "pdf_draft" || input.output_format === "csv" ? "L2" : "L1";
}

/**
 * Free tier html_preview のウォーターマーク文字列 (ADR-020 §Decision §3)
 * Watermark string for Free tier html_preview
 */
export const HTML_PREVIEW_WATERMARK =
  "【下書き・参考資料】本書類は行政書士による確認前の参考資料です。" +
  "改正行政書士法§19により、申請書類の作成代行は行政書士のみが行えます。" +
  "Pro プランへのアップグレード後、行政書士アカウントで実際の申請書類を生成してください。" +
  " https://ssw-compass.jp/upgrade";

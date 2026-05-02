/**
 * list_visa_documents v4 拡張 inputSchema (v4 §3.3 / ADR-020 / sprint-4-plan §3.8)
 * v4 extension of list_visa_documents inputSchema
 * Ekstensi v4 dari inputSchema list_visa_documents
 *
 * Public submission surface: read-only informational output only.
 */

import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { ListVisaDocumentsInput } from "../list-visa-documents.js";

/**
 * 出力形式
 * Output format
 * Format keluaran
 */
export const DocumentOutputFormat = z.enum([
  "json", // 構造化 JSON (デフォルト、Free OK)
  "html_preview", // 参考用 HTML プレビュー (Free OK)
]);
export type DocumentOutputFormat = z.infer<typeof DocumentOutputFormat>;

export const ListVisaDocumentsInputV4 = ListVisaDocumentsInput.extend({
  /** 省略条件を適用するか (default: true) */
  include_omission_conditions: z
    .boolean()
    .default(true)
    .describe("省略条件を適用して書類数を削減する"),

  /** 出力形式 */
  output_format: DocumentOutputFormat.default("json"),

  /** 出力言語 (v4 10言語対応) */
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
}).strict();
export type ListVisaDocumentsInputV4 = z.infer<typeof ListVisaDocumentsInputV4>;

/**
 * html_preview の注記
 * Note for html_preview
 */
export const HTML_PREVIEW_WATERMARK =
  "【参考情報】この一覧は公式情報源に基づく一般情報です。実際の申請では出入国在留管理庁の最新案内を確認してください。";

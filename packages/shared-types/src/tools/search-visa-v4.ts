/**
 * search_visa v4 拡張 inputSchema (v4 §3.1 / sprint-4-plan §3.8)
 * v4 extension of search_visa inputSchema
 * Ekstensi v4 dari inputSchema search_visa
 *
 * Interface Freeze (sprint-4-plan §3.8): Sprint 4 全期間で不変。
 * v3 SearchVisaInput の フィールド名・型を破壊しない (.extend() パターン)。
 *
 * 10言語対応: ADR-018 の段階的 rollout に従い、
 * Vertex grounding は ja/en/id のみ本格対応。
 * 追加 7 言語は disclaimer のみ Sprint 4 で先行提供。
 */

import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { SearchVisaInput } from "../search-visa.js";

export const SearchVisaInputV4 = SearchVisaInput.extend({
  /**
   * 出力言語 (v3: ja/en/id → v4: 10言語)
   * v3 の language フィールドは enum("ja","en","id") のみだったが
   * v4 で SUPPORTED_LANGUAGES (10言語) に拡張。
   * backward compat: default は "ja" で変わらない。
   */
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),

  /** 回答スタイル: concise=簡潔, detailed=詳細, stepbystep=手順形式 */
  response_style: z
    .enum(["concise", "detailed", "stepbystep"])
    .default("concise")
    .describe("回答スタイル: 簡潔 / 詳細 / ステップ形式"),

  /** フォローアップ提案を有効にするか (default: true) */
  enable_followup_suggestions: z
    .boolean()
    .default(true)
    .describe("フォローアップ質問の提案を有効にする"),
}).strict();
export type SearchVisaInputV4 = z.infer<typeof SearchVisaInputV4>;

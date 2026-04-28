/**
 * 対応言語定義 (ADR-018 / v4 §3.1)
 * Supported language definitions
 * Definisi bahasa yang didukung
 *
 * Interface Freeze (ADR-018): SUPPORTED_LANGUAGES は Sprint 4 全期間で不変。
 *
 * VERTEX_GROUNDED_LANGUAGES: Sprint 4 時点で Vertex grounding が本格品質保証される言語。
 * 残り 7 言語は disclaimer のみ先行対応。grounding 品質は Sprint 5 で段階的に改善。
 * (ADR-018 §段階的 rollout)
 */

export const SUPPORTED_LANGUAGES = [
  "ja", // 日本語 (Vertex grounding 対応)
  "en", // English (Vertex grounding 対応)
  "id", // Bahasa Indonesia (Vertex grounding 対応)
  "zh-CN", // 中文（简体）— disclaimer のみ Sprint 4
  "zh-TW", // 中文（繁體）— disclaimer のみ Sprint 4
  "vi", // Tiếng Việt — disclaimer のみ Sprint 4
  "tl", // Filipino (Tagalog) — disclaimer のみ Sprint 4
  "th", // ภาษาไทย — disclaimer のみ Sprint 4
  "km", // ភាសាខ្មែរ — disclaimer のみ Sprint 4
  "my", // မြန်မာဘာသာ — disclaimer のみ Sprint 4
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Sprint 4 で Vertex grounding が本格品質保証される言語 (ADR-018)
 * Languages with full Vertex grounding quality assurance in Sprint 4
 * Bahasa dengan jaminan kualitas Vertex grounding penuh di Sprint 4
 */
export const VERTEX_GROUNDED_LANGUAGES = ["ja", "en", "id"] as const;
export type VertexGroundedLanguage = (typeof VERTEX_GROUNDED_LANGUAGES)[number];

/**
 * 指定言語が Vertex grounding でサポートされているかを返す
 * Returns whether the given language has Vertex grounding support
 */
export function isVertexGrounded(lang: SupportedLanguage): lang is VertexGroundedLanguage {
  return (VERTEX_GROUNDED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * UI コンポーネントが現在サポートする表示言語 (ja/en/id のみ)
 * Sprint 4 Batch 8 時点で UI の i18n 辞書は 3 言語のみ。
 * Batch 9-10 で UI を 10 言語対応に順次拡張する。
 *
 * UI components supported display languages (ja/en/id only)
 * As of Sprint 4 Batch 8, UI i18n dictionaries support only 3 languages.
 */
export const UI_LANGUAGES = ["ja", "en", "id"] as const;
export type UILanguage = (typeof UI_LANGUAGES)[number];

/** SupportedLanguage を UILanguage に正規化する (未対応言語は "en" fallback) */
export function toUILanguage(lang: SupportedLanguage): UILanguage {
  return (UI_LANGUAGES as readonly string[]).includes(lang) ? (lang as UILanguage) : "en";
}

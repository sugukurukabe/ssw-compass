/**
 * Cloud DLP 設定 — ADR-011 で確定した定数 (Sprint 4 全期間で不変)
 * Cloud DLP configuration — constants finalized in ADR-011 (immutable for Sprint 4)
 * Konfigurasi Cloud DLP — konstanta yang ditetapkan di ADR-011 (tidak berubah selama Sprint 4)
 *
 * この定数を変更するには ADR を起票すること (.cursor/rules/security.mdc 参照)。
 * Modifying this constant requires filing an ADR (see .cursor/rules/security.mdc).
 * Mengubah konstanta ini memerlukan pengajuan ADR (lihat .cursor/rules/security.mdc).
 *
 * minLikelihood=LIKELY (4) は Sprint 3 Batch 6 の false-positive 修正として採用。
 * POSSIBLE (3) は日本語 SSW 語彙で誤検出を起こした (ADR-011 §Context §Sprint 3 incident)。
 */

/**
 * Cloud DLP の minLikelihood 値 (数値マッピング)
 * Cloud DLP minLikelihood numeric mapping
 */
const LIKELIHOOD_LIKELY = 4; // LIKELY — 感度: POSSIBLE より保守的、高信頼性マッチのみ
const DLP_TIMEOUT_MS = 3_000; // 3 秒: v2 §8.3 Cloud Run p99 target

export const DLP_CONFIG = {
  /**
   * LIKELY (4): POSSIBLE (3) より保守的。
   * 日本語フリーテキスト中の digit sequence での誤検出を防ぐ。
   * Sprint 3 で POSSIBLE を使った際に "特定技能1号 建設分野" が誤検出された実績による。
   */
  minLikelihood: LIKELIHOOD_LIKELY,

  /**
   * ブロック対象 infoType (変更には ADR 必須)
   * BLOCKING_INFO_TYPES — source of truth for what DLP blocks.
   *
   * 意図的に除外:
   * - EMAIL_ADDRESS, PHONE_NUMBER: 正当な入力としてビザ照会で使われる
   *   (embassy 連絡先等)。regex ステージでも除外済み (post-Sprint-3 cleanup)。
   * - IBAN_CODE: SSW ビザドメインと無関係。
   */
  blockingInfoTypes: [
    "JAPAN_INDIVIDUAL_NUMBER",
    "JAPAN_PASSPORT",
    "JAPAN_DRIVERS_LICENSE_NUMBER",
    // NOTE: ZAIRYU_CARD_NUMBER is a CUSTOM infoType defined in customInfoTypes below.
    // Do NOT include it here as a built-in infoType name — DLP API returns
    // INVALID_ARGUMENT if a custom type name is passed in the infoTypes list.
    // The custom infoType detector handles it via the customInfoTypes field.
    "CREDIT_CARD_NUMBER",
  ] as const,

  /** カスタム infoType — DLP 組み込みにない在留カード番号パターン */
  customInfoTypes: [
    {
      info_type: { name: "ZAIRYU_CARD_NUMBER" },
      regex: { pattern: "\\b[A-Z]{2}[0-9]{8}[A-Z]{2}\\b" },
    },
  ],

  /** 引用文の保存を抑制 (個人情報をログに残さない) */
  includeQuote: false,

  /** API タイムアウト (ms) — 超過時は fail-closed */
  timeoutMs: DLP_TIMEOUT_MS,
} as const;

export type DlpConfigShape = typeof DLP_CONFIG;

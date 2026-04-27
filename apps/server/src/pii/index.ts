/**
 * PII guard — regex stage (Sprint 1).
 *
 * Sprint 3 will layer Cloud DLP API inspectContent() behind the same
 * Promise<PiiScrubResult> surface (see v2 §7.1 for the full two-stage design).
 * Keeping the same return shape means handler sites need zero changes when DLP
 * is wired in.
 *
 * BLOCKING_TYPES is the source of truth — modifications require ADR per
 * .cursor/rules/security.mdc.
 */

const REGEX = {
  zairyu: /\b[A-Z]{2}[0-9]{8}[A-Z]{2}\b/,
  myNumber: /\b\d{12}\b/,
  passport: /\b[A-Z]{1,2}\d{7}\b/,
  email: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,
  phone: /(?:\+?81|0)\d{1,4}-?\d{1,4}-?\d{3,4}/,
} as const;

const HOTWORDS: readonly string[] = [
  "在留カード",
  "residence card",
  "マイナンバー",
  "個人番号",
  "旅券",
  "passport",
  "氏名",
  "本名",
];

const BLOCKING_TYPES: ReadonlySet<string> = new Set([
  "JAPAN_INDIVIDUAL_NUMBER",
  "JAPAN_PASSPORT",
  "JAPAN_DRIVERS_LICENSE_NUMBER",
  "ZAIRYU_CARD_NUMBER",
  "CREDIT_CARD_NUMBER",
]);

export interface PiiScrubResult {
  blocked: boolean;
  types: string[];
}

export async function scrubInputForPII(args: unknown): Promise<PiiScrubResult> {
  const text = JSON.stringify(args);
  const hits: string[] = [];

  if (REGEX.zairyu.test(text)) {
    hits.push("ZAIRYU_CARD_NUMBER");
  }
  if (REGEX.myNumber.test(text) && HOTWORDS.some((h) => text.includes(h))) {
    hits.push("JAPAN_INDIVIDUAL_NUMBER");
  }
  if (REGEX.passport.test(text)) {
    hits.push("JAPAN_PASSPORT");
  }

  const blocked = hits.some((t) => BLOCKING_TYPES.has(t));
  return { blocked, types: hits };
}

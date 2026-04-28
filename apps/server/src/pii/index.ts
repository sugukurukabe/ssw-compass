/**
 * PII guard — two-stage per v2 §7.1.
 *
 * Stage 1 (always on): regex against the concatenated arg JSON for
 * zairyu / individual-number / passport patterns.
 *
 * Stage 2 (gated on `DLP_ENABLED=true`): Cloud DLP `inspectContent`
 * via [dlp-client.ts](./dlp-client.ts). Fail-closed on API error
 * (Batch 5 judgment 3). Sprint 3 Batch 5 wires this stage in; prior
 * Sprints ran regex-only.
 *
 * The Promise<PiiScrubResult> contract is unchanged from Sprint 1 —
 * handler sites need zero edits. The `reason` field in the structured
 * log records which stage fired (regex / dlp / dlp_api_error) per v2
 * §9 structured logging principle, while user-facing error stays
 * generic ("PII detected") per Batch 5 judgment 4.
 *
 * BLOCKING_TYPES is the source of truth — modifications require ADR
 * per .cursor/rules/security.mdc.
 */

import { logger } from "../logger.js";
import { inspectWithDlp } from "./dlp-client.js";

// Regex stage blocks only the three hard-PII categories enumerated in
// v2 §7.1. Email addresses and phone numbers are intentionally NOT
// blocked here — they are legitimate inputs for some visa queries
// (e.g., embassy contact lookups) and are handled one layer over by:
// (a) pino redaction in apps/server/src/logger.ts (`*.email`,
//     `*.phone`) for log hygiene, and
// (b) Cloud DLP's built-in EMAIL_ADDRESS / PHONE_NUMBER infoTypes in
//     the stage-2 path when DLP_ENABLED=true (see dlp-client.ts).
// Any expansion of this list requires an ADR per .cursor/rules/security.mdc.
const REGEX = {
  zairyu: /\b[A-Z]{2}[0-9]{8}[A-Z]{2}\b/,
  myNumber: /\b\d{12}\b/,
  passport: /\b[A-Z]{1,2}\d{7}\b/,
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

function runRegexStage(text: string): string[] {
  const hits: string[] = [];
  if (REGEX.zairyu.test(text)) hits.push("ZAIRYU_CARD_NUMBER");
  if (REGEX.myNumber.test(text) && HOTWORDS.some((h) => text.includes(h))) {
    hits.push("JAPAN_INDIVIDUAL_NUMBER");
  }
  if (REGEX.passport.test(text)) hits.push("JAPAN_PASSPORT");
  return hits;
}

function isDlpEnabled(): boolean {
  return process.env["DLP_ENABLED"] === "true";
}

function resolveDlpProject(): string {
  const project =
    process.env["CLOUDSDK_CORE_PROJECT"] ??
    process.env["SSW_VERTEX_PROJECT"] ??
    process.env["GOOGLE_CLOUD_PROJECT"];
  if (project === undefined || project.length === 0) {
    throw new Error(
      "DLP_ENABLED=true requires CLOUDSDK_CORE_PROJECT, SSW_VERTEX_PROJECT, or GOOGLE_CLOUD_PROJECT.",
    );
  }
  return project;
}

export async function scrubInputForPII(args: unknown): Promise<PiiScrubResult> {
  const text = JSON.stringify(args);

  const regexHits = runRegexStage(text);
  const regexBlocked = regexHits.some((t) => BLOCKING_TYPES.has(t));
  if (regexBlocked) {
    logger.warn(
      { event: "pii_blocked", level: "warning", reason: "regex", findings: regexHits },
      "pii_blocked",
    );
    return { blocked: true, types: regexHits };
  }

  if (!isDlpEnabled()) {
    return { blocked: false, types: regexHits };
  }

  const projectId = resolveDlpProject();
  const dlp = await inspectWithDlp(projectId, text);

  if (dlp.apiError !== undefined) {
    logger.warn(
      {
        event: "pii_blocked",
        level: "warning",
        reason: "dlp_api_error",
        dlp_error_code: dlp.apiError.code,
        dlp_latency_ms: dlp.apiError.latencyMs,
        dlp_error_message: dlp.apiError.message,
      },
      "pii_blocked",
    );
    return { blocked: true, types: [...regexHits, ...dlp.types] };
  }

  if (dlp.blocked) {
    logger.warn(
      { event: "pii_blocked", level: "warning", reason: "dlp", findings: dlp.types },
      "pii_blocked",
    );
    return { blocked: true, types: [...regexHits, ...dlp.types] };
  }

  return { blocked: false, types: regexHits };
}

/**
 * Cloud DLP inspection client — Sprint 3 Batch 5.
 *
 * Second stage of the PII guard per v2 §7.1. Called after the regex
 * stage in [pii/index.ts](./index.ts) when `DLP_ENABLED=true`.
 *
 * Fail-closed: any DLP API error returns `{ blocked: true, types:
 * [...], error: <reason> }` so upstream callers treat the request
 * as PII-suspect when the inspection service itself is unavailable
 * (per ADR-010-esque defense-in-depth reasoning; also see
 * .cursor/rules/security.mdc "Never bypass pii guard for
 * performance").
 *
 * Custom infoType for ZAIRYU_CARD_NUMBER is declared inline (DLP
 * built-in does not cover Japan's 在留カード番号 pattern); the
 * regex mirrors REGEX.zairyu in pii/index.ts (single source of
 * truth for the pattern would be nice — deferred to a Sprint 4+
 * refactor).
 *
 * Latency: typical 100-300 ms synchronous. Timeout bound to 3 s
 * per v2 §8.3 Cloud Run p99 target; above that we fail-closed
 * rather than delay the user.
 */

import { DlpServiceClient, type protos } from "@google-cloud/dlp";

type Likelihood = protos.google.privacy.dlp.v2.Likelihood;
type InfoType = protos.google.privacy.dlp.v2.IInfoType;
type InspectContentRequest = protos.google.privacy.dlp.v2.IInspectContentRequest;

const DLP_TIMEOUT_MS = 3_000;

/**
 * BLOCKING_TYPES — v2 §7.1 source-of-truth set. Any change requires
 * an ADR per .cursor/rules/security.mdc.
 */
const BLOCKING_INFO_TYPES: readonly string[] = [
  "JAPAN_INDIVIDUAL_NUMBER",
  "JAPAN_PASSPORT",
  "JAPAN_DRIVERS_LICENSE_NUMBER",
  "ZAIRYU_CARD_NUMBER", // custom infoType (see custom_info_types below)
  "CREDIT_CARD_NUMBER",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "IBAN_CODE",
];

const CUSTOM_INFO_TYPES = [
  {
    info_type: { name: "ZAIRYU_CARD_NUMBER" },
    regex: { pattern: "\\b[A-Z]{2}[0-9]{8}[A-Z]{2}\\b" },
  },
];

const MIN_LIKELIHOOD: Likelihood = 3; // POSSIBLE — tighter than DEFAULT (UNLIKELY)

let _client: DlpServiceClient | null = null;

/**
 * Test seam — production never calls this.
 */
export function __setDlpClientForTesting(client: DlpServiceClient | null): void {
  _client = client;
}

function getClient(): DlpServiceClient {
  if (_client !== null) return _client;
  _client = new DlpServiceClient();
  return _client;
}

export interface DlpInspectResult {
  blocked: boolean;
  types: string[];
  /** Present only when fail-closed due to API/timeout error. */
  apiError?: { code: string; message: string; latencyMs: number };
}

/**
 * Inspect a text payload via Cloud DLP inspectContent.
 *
 * @param projectId GCP project owning the DLP quota (CLOUDSDK_CORE_PROJECT or SSW_VERTEX_PROJECT).
 * @param text concatenated arg JSON from `scrubInputForPII`.
 */
export async function inspectWithDlp(projectId: string, text: string): Promise<DlpInspectResult> {
  const client = getClient();
  const t0 = performance.now();
  const infoTypes: InfoType[] = BLOCKING_INFO_TYPES.map((name) => ({ name }));

  const request: InspectContentRequest = {
    parent: `projects/${projectId}/locations/global`,
    inspectConfig: {
      infoTypes,
      customInfoTypes: CUSTOM_INFO_TYPES,
      minLikelihood: MIN_LIKELIHOOD,
      includeQuote: false,
    },
    item: { value: text },
  };

  try {
    const [response] = await Promise.race([
      client.inspectContent(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DLP timeout exceeded")), DLP_TIMEOUT_MS),
      ),
    ]);
    const findings = response.result?.findings ?? [];
    const types = Array.from(
      new Set(
        findings.map((f) => f.infoType?.name).filter((n): n is string => typeof n === "string"),
      ),
    );
    return { blocked: types.length > 0, types };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "UNKNOWN";
    return {
      blocked: true, // fail-closed per Batch 5 judgment 3
      types: ["DLP_API_ERROR"],
      apiError: { code, message, latencyMs },
    };
  }
}

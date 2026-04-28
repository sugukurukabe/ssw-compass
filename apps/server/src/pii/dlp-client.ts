/**
 * Cloud DLP inspection client — Sprint 3 Batch 5 / ADR-011 Sprint 4 Batch 4.
 *
 * Second stage of the PII guard per v2 §7.1. Called after the regex
 * stage in [pii/index.ts](./index.ts) when `DLP_ENABLED=true`.
 *
 * Fail-closed: any DLP API error returns `{ blocked: true, ... }` so
 * upstream callers treat the request as PII-suspect when the inspection
 * service itself is unavailable (defense-in-depth per .cursor/rules/security.mdc).
 *
 * Configuration is centralised in [dlp-config.ts](./dlp-config.ts).
 * Changing minLikelihood or blockingInfoTypes requires an ADR.
 *
 * Latency: typical 100-300 ms synchronous. Timeout bound to 3 s per
 * dlp-config.ts DLP_CONFIG.timeoutMs; above that we fail-closed.
 */

import { DlpServiceClient, type protos } from "@google-cloud/dlp";
import { DLP_CONFIG } from "./dlp-config.js";

type InfoType = protos.google.privacy.dlp.v2.IInfoType;
type InspectContentRequest = protos.google.privacy.dlp.v2.IInspectContentRequest;

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
 * @param projectId GCP project owning the DLP quota.
 * @param text concatenated arg JSON from `scrubInputForPII`.
 */
export async function inspectWithDlp(projectId: string, text: string): Promise<DlpInspectResult> {
  const client = getClient();
  const t0 = performance.now();
  const infoTypes: InfoType[] = DLP_CONFIG.blockingInfoTypes.map((name) => ({ name }));

  const request: InspectContentRequest = {
    parent: `projects/${projectId}/locations/global`,
    inspectConfig: {
      infoTypes,
      // Spread to convert readonly tuple to mutable array expected by DLP SDK
      customInfoTypes: [...DLP_CONFIG.customInfoTypes],
      minLikelihood: DLP_CONFIG.minLikelihood,
      includeQuote: DLP_CONFIG.includeQuote,
    },
    item: { value: text },
  };

  try {
    const [response] = await Promise.race([
      client.inspectContent(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DLP timeout exceeded")), DLP_CONFIG.timeoutMs),
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
      blocked: true, // fail-closed — ADR-011 §Decision §Output sanitizer
      types: ["DLP_API_ERROR"],
      apiError: { code, message, latencyMs },
    };
  }
}

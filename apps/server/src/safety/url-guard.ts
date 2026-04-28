/**
 * Application-layer egress URL guard — Sprint 3 Batch 6.
 *
 * Per ADR-012 §safeFetch and v3 §23.2, the server restricts outbound
 * HTTP to a narrow allowlist. Network-layer egress is also pinned to
 * the Cloud NAT static IP via the Serverless VPC Access connector
 * (module.vpc_egress), but SSRF defence requires belt-and-braces:
 * this is the application-layer belt.
 *
 * Allowlist rationale:
 *   - *.googleapis.com         (Vertex AI Search / Secret Manager / Logging)
 *   - *.cloud.google.com       (IAM / OAuth token endpoints)
 *   - *.go.jp **subdomain-only** (Sprint 4 Phase 1 source ingestion;
 *     narrower than the v3 spec's `go.jp` which would match the bare
 *     TLD root per Batch 6 user addendum)
 *
 * Non-https and non-allowlisted hosts throw `egress_blocked:*` errors.
 * These errors are caught upstream and surface to the MCP client as
 * generic "retrieval failed" messages; detail stays in Cloud Logging.
 */

const ALLOWED_HOSTS_RE = /^([\w-]+\.)?(googleapis\.com|cloud\.google\.com)$|^[\w.-]+\.go\.jp$/;

export interface SafeFetchError {
  reason: "non_https" | "host_not_allowlisted" | "invalid_url";
  host?: string;
  protocol?: string;
  inputUrl: string;
}

/**
 * Fetch-compatible wrapper with egress allowlist + https-only enforcement.
 * Throws a plain `Error` on block so upstream `try/catch` can log the
 * structured reason via `explainBlock(error)`.
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw Object.assign(new Error(`egress_blocked: invalid_url (${url})`), {
      _safeFetch: {
        reason: "invalid_url" satisfies SafeFetchError["reason"],
        inputUrl: url,
      },
      _cause: err,
    });
  }
  if (parsed.protocol !== "https:") {
    throw Object.assign(new Error(`egress_blocked: non_https (${parsed.protocol})`), {
      _safeFetch: {
        reason: "non_https" satisfies SafeFetchError["reason"],
        host: parsed.hostname,
        protocol: parsed.protocol,
        inputUrl: url,
      },
    });
  }
  if (!ALLOWED_HOSTS_RE.test(parsed.hostname)) {
    throw Object.assign(new Error(`egress_blocked: host_not_allowlisted (${parsed.hostname})`), {
      _safeFetch: {
        reason: "host_not_allowlisted" satisfies SafeFetchError["reason"],
        host: parsed.hostname,
        inputUrl: url,
      },
    });
  }
  return fetch(url, init);
}

/**
 * Structured extractor for upstream logging. Returns the `_safeFetch`
 * shape when present; otherwise `null` (the error is not from this guard).
 */
export function explainBlock(err: unknown): SafeFetchError | null {
  if (err !== null && typeof err === "object" && "_safeFetch" in err) {
    return (err as { _safeFetch: SafeFetchError })._safeFetch;
  }
  return null;
}

/**
 * Public allowlist regex for tests + documentation. Do not export the
 * regex object directly to avoid mutation; expose the source string.
 */
export const ALLOWED_HOSTS_REGEX_SOURCE = ALLOWED_HOSTS_RE.source;

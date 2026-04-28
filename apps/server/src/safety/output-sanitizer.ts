/**
 * Output sanitizer for retrieved snippets — defense against indirect prompt
 * injection per v3 §23.1. Pattern set is fully defined below.
 *
 * Sprint 3 Batch 5 activated: SANITIZATION_ACTIVE = true. ADR-011 (Sprint 4
 * Batch 4) confirmed this pattern is correct and documented the known soft-hyphen
 * weakness (CONTROL_CHARS runs last; Sprint 4 Phase 3 carry-over). All retrieved
 * snippets pass through the 4 pattern categories (INJECTION_PATTERNS,
 * SUSPICIOUS_URL, CODE_FENCE, CONTROL_CHARS) and any hit is replaced with
 * a neutralising marker + logged via `event: "retrieved_content_sanitized"`
 * in Cloud Logging. Fixture mode (current staging SSW_VERTEX_MODE) produces
 * clean content so activation should not change observable output until
 * Sprint 4 Phase 1 flips to real Vertex where sanitizer catches any bad
 * retrievals.
 *
 * .cursor/rules/security.mdc forbids bypass "for performance" — any change
 * here requires a paired snapshot test update (test/safety/sanitizer.snapshot.test.ts).
 */

const SANITIZATION_ACTIVE = true;

export const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  /これまでの(指示|プロンプト|命令)を?(無視|忘れ)/,
  /forget\s+(everything|your\s+role|your\s+instructions)/i,
  /system\s*:\s*you\s+are/i,
  /\bdisregard\s+(the\s+)?(rules?|guidelines?)/i,
  /<\s*\/?\s*(system|instruction|prompt)\s*>/i,
];

export const SUSPICIOUS_URL = /https?:\/\/(?!.*\.go\.jp\b)[\w.-]+/g;
export const CODE_FENCE = /```[\s\S]*?```/g;
export const CONTROL_CHARS = /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u00AD]/g;

export interface SanitizeResult {
  safe: string;
  flagged: boolean;
  reasons: string[];
}

export function sanitizeRetrievedSnippet(raw: string): SanitizeResult {
  if (!SANITIZATION_ACTIVE) {
    return { safe: raw, flagged: false, reasons: [] };
  }

  const reasons: string[] = [];
  let safe = raw;

  if (CODE_FENCE.test(safe)) {
    safe = safe.replace(CODE_FENCE, "[コードブロック削除]");
    reasons.push("code_fence_removed");
  }

  for (const re of INJECTION_PATTERNS) {
    if (re.test(safe)) {
      safe = safe.replace(re, "[suspicious_instruction_removed]");
      reasons.push(`injection_pattern:${re.source.slice(0, 20)}`);
    }
  }

  const urlMatches = [...safe.matchAll(SUSPICIOUS_URL)];
  if (urlMatches.length > 0) {
    safe = safe.replace(SUSPICIOUS_URL, (m) => `[external_url:${new URL(m).hostname}]`);
    reasons.push(`external_urls_neutralized:${urlMatches.length}`);
  }

  safe = safe.replace(CONTROL_CHARS, "");

  return { safe, flagged: reasons.length > 0, reasons };
}

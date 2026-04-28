# ADR-011: Cloud DLP minLikelihood tuning + output sanitizer pattern

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 4; previously reserved in Sprint 3)
- **Sprint 3 reservation note**: Sprint 3 Batch 5 implemented Cloud DLP and the
  output sanitizer but deferred the configuration decisions to Sprint 4 (Batch 6
  hotfix: `DLP_ENABLED=false` on staging due to false-positives on the neutral smoke
  query "特定技能1号 建設分野"). This ADR closes that reservation.
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `apps/server/src/pii/dlp-client.ts`,
  `apps/server/src/pii/dlp-config.ts` (new),
  `apps/server/src/safety/output-sanitizer.ts`

---

## Context

### Sprint 3 false-positive incident

In Sprint 3 Batch 6 the staging Cloud Run smoke test failed because
`DLP_ENABLED=true` with `minLikelihood=POSSIBLE (3)` flagged the neutral
query "特定技能1号 建設分野" as PII. Analysis:

- The phrase "1号" + "建設" combination is a Japanese SSW visa category
  description. No PII is present.
- Cloud DLP's `PHONE_NUMBER` or `JAPAN_INDIVIDUAL_NUMBER` infoType matched
  on the digit sequence "1" embedded in the query, which at `POSSIBLE`
  likelihood generated a false-positive finding.
- Mitigation at the time: set `DLP_ENABLED=false` on staging.

### DLP infoType audit

The Sprint 3 `dlp-client.ts` includes `EMAIL_ADDRESS`, `PHONE_NUMBER`, and
`IBAN_CODE` in `BLOCKING_INFO_TYPES`. The v4 §3.6 DLP sensitivity review
identified that:

- **`EMAIL_ADDRESS` / `PHONE_NUMBER`**: legitimate inputs for some visa
  queries (embassy contact lookups). Were already removed from the
  regex stage in the post-Sprint-3 cleanup PR (chore/post-sprint-3-cleanup).
  Keeping them in the DLP stage may generate false-positives without
  corresponding security benefit.
- **`IBAN_CODE`**: irrelevant to the SSW visa domain. No legitimate reason
  for an IBAN to appear in a visa procedure query.
- **Hard PII** (`JAPAN_INDIVIDUAL_NUMBER`, `JAPAN_PASSPORT`,
  `JAPAN_DRIVERS_LICENSE_NUMBER`, `ZAIRYU_CARD_NUMBER`, `CREDIT_CARD_NUMBER`):
  all correctly retained.

### minLikelihood calibration

| Value | Int | Effect |
|---|---:|---|
| UNLIKELY | 2 | Most sensitive; many false-positives for Japanese free text |
| POSSIBLE | 3 | Sprint 3 setting; caused false-positive on neutral SSW query |
| **LIKELY** | **4** | **Chosen for Sprint 4** |
| VERY_LIKELY | 5 | May miss some real PII |
| CERTAIN | 6 | Only exact-match findings; too loose for defense-in-depth |

---

## Decision

### 1. `minLikelihood = LIKELY (4)` for staging and production

Raise from `POSSIBLE (3)` to `LIKELY (4)`. This is calibrated to:
- Stop flagging incidental digit sequences in Japanese SSW vocabulary.
- Still catch high-confidence PII matches (residence card numbers,
  passport numbers, individual numbers).
- Re-enable `DLP_ENABLED=true` on staging after this change.

### 2. Remove `EMAIL_ADDRESS`, `PHONE_NUMBER`, `IBAN_CODE` from DLP blocking list

Rationale: consistent with the regex-stage decision (post-Sprint-3 cleanup)
and the SSW domain context. Remaining BLOCKING_INFO_TYPES:

```
JAPAN_INDIVIDUAL_NUMBER
JAPAN_PASSPORT
JAPAN_DRIVERS_LICENSE_NUMBER
ZAIRYU_CARD_NUMBER          (custom infoType)
CREDIT_CARD_NUMBER
```

### 3. Extract `DLP_CONFIG` as a named constant in `dlp-config.ts`

Centralise all DLP parameters in one file so future tuning requires a
single-file change + ADR update (no more hunting across dlp-client.ts).

`DLP_CONFIG` is exported from `apps/server/src/pii/dlp-config.ts` and
imported by `dlp-client.ts`. Changing it requires ADR per
`.cursor/rules/security.mdc`.

### 4. Re-enable `DLP_ENABLED=true` on staging

Update `infra/terraform/envs/staging/main.tf` `env_vars.DLP_ENABLED` from
`"false"` to `"true"`. This also removes the explanatory comment that cited
the Sprint 3 false-positive, replacing it with a reference to this ADR.

### 5. Output sanitizer pattern is confirmed and documented

`apps/server/src/safety/output-sanitizer.ts` (Sprint 3 Batch 5) is
confirmed as the correct implementation. No code changes needed for the
sanitizer itself.

Known weakness (sprint-4-pending §3.7): soft-hyphen smuggling slips past
`INJECTION_PATTERNS` because `CONTROL_CHARS` stripping runs last.
Proposed fix (reorder so CONTROL_CHARS runs first) is Sprint 4 Phase 3
carry-over (ADR-011 reserved slot for this hardening).

---

## Alternatives rejected

### A. Keep `minLikelihood=POSSIBLE`

The Sprint 3 false-positive demonstrates that POSSIBLE is too sensitive for
Japanese free-text visa queries. Rejected.

### B. Keep `EMAIL_ADDRESS` / `PHONE_NUMBER` in the DLP blocking list

Would re-introduce false-positives on embassy contact queries. The regex
stage already removed these for the same reason. Rejected for consistency.

### C. Add an allow-list of Japanese visa vocabulary tokens

A curated allow-list that DLP should ignore would prevent false-positives more
precisely, but is a higher-maintenance approach. `LIKELY` threshold achieves
the same result with simpler config. Deferred to Sprint 5 if LIKELY still
generates false-positives after production observation.

### D. Disable DLP entirely (`DLP_ENABLED=false`) in production

Removing the second stage of the PII guard weakens defense-in-depth.
Rejected. The regex stage alone may miss future PII patterns.

---

## Consequences

### `DLP_CONFIG` shape (frozen for Sprint 4)

```typescript
export const DLP_CONFIG = {
  minLikelihood: "LIKELY" as const,
  blockingInfoTypes: [
    "JAPAN_INDIVIDUAL_NUMBER",
    "JAPAN_PASSPORT",
    "JAPAN_DRIVERS_LICENSE_NUMBER",
    "ZAIRYU_CARD_NUMBER",
    "CREDIT_CARD_NUMBER",
  ] as const,
  customInfoTypes: [
    {
      info_type: { name: "ZAIRYU_CARD_NUMBER" },
      regex: { pattern: "\\b[A-Z]{2}[0-9]{8}[A-Z]{2}\\b" },
    },
  ],
  includeQuote: false,
  timeoutMs: 3_000,
} as const;
```

Modifying `blockingInfoTypes` or `minLikelihood` requires a new or amended ADR.

### Staging re-enablement

`DLP_ENABLED` flips to `"true"` in `infra/terraform/envs/staging/main.tf`.
After the next `terraform apply`, Cloud Run staging will run DLP on every MCP
request. The smoke test "特定技能1号 建設分野" should pass without a false-positive.

### Soft-hyphen carry-over (Sprint 4 Phase 3)

The known weakness in `output-sanitizer.ts` (soft-hyphen smuggling via
`\u00AD`) is NOT fixed in this Batch. It remains in sprint-4-pending.md §3.7
as a Phase 3 carry-over. The snapshot test in `sanitizer.snapshot.test.ts`
records the current (imperfect) behaviour with a `// known weakness` comment.

---

## Related

- Sprint 3 sprint-3-summary.md §2: Hotfix bucket `runtime-config-drift` — DLP
  false-positive on staging smoke
- sprint-4-pending.md §3.6: DLP sensitivity tuning (this ADR resolves it)
- sprint-4-pending.md §3.7: Output sanitizer soft-hyphen hardening (still open)
- `.cursor/rules/security.mdc`: BLOCKING_TYPES change requires ADR

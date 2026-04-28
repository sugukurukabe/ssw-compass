# ADR-014: HITL lockgate pattern — assertHitlGate, per-call escalation, case_id

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 3)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `packages/shared-types/src/hitl/`, `packages/shared-types/src/case-id.ts`,
  `apps/server/src/hitl/`, existing 4 tool registrations

---

## Context

v4 §2 defines 12 HITL controls (H01-H12) to address the 2026-01-01
改正行政書士法 §19 "いかなる名目" amendment and 2025-06 入管法 §73-2
厳罰化. Batch 3 implements the structural skeleton:

- **H01_DRAFT_LOCKGATE**: server-side rejection of L2/L3 tools for
  Free / unauthenticated-gyoseishoshi users (most critical control)
- **H04_AUDIT_LOG_7Y**: annotation flag; actual GCS write implemented in Batch 6
- **H07_PII_AUTO_MASKING**: annotation flag; actual guard is the existing
  `scrubInputForPII` from Sprint 3
- Other H02-H12: annotation flags; full enforcement in later Batches

The `validateToolAnnotations` function runs at server startup and **crashes**
if any L2/L3 tool is missing H01 or `requiresGyoseishoshiAuth: true`.
This makes mis-configuration a deploy-time error, not a runtime surprise.

---

## Decision

### 1. Static legalLevel per tool annotation

Every registered tool carries a `legalLevel: "L0" | "L1" | "L2" | "L3"` in
its annotations. L4 is permanently prohibited (never implement).

| Tool | Static legalLevel | Tier |
|---|---|---|
| `search_visa` | L0 | free |
| `classify_procedure` | L1 | free |
| `get_deadline_timeline` | L1 | free |
| `list_visa_documents` | L1 | free |
| `list_law_updates` (Batch 9) | L0 | free |
| `submit_gyoseishoshi_approval` (Batch 10) | L2 | pro |
| `validate_zairyu_compatibility` (Batch 10) | L1 | free |

### 2. Per-call escalation (v4 §ADR-014)

Some tools have an annotation legalLevel as a **floor** but escalate
at runtime based on input. The escalation must be:
- Deterministic from input schema alone (no network calls, no DB reads)
- Explicit in handler JSDoc referencing ADR-014

Known escalations for Sprint 4:

| Tool | Static | Escalation input | Effective |
|---|---|---|---|
| `list_visa_documents` | L1 | `output_format ∈ {"pdf_draft","csv"}` | L2 |

Escalation uses `assertHitlGateRuntime(auth, toolId, staticLevel, runtimeLevel)`.

### 3. case_id generation — nanoid base36, 16 chars

v4 §3.4 specifies `/^case_[a-z0-9]{16}$/`. This provides ~82 bits of
entropy (36^16 ≈ 7.96×10^24). nanoid `customAlphabet` is used with the
lowercase alphanumeric alphabet to avoid `crypto.randomBytes` overhead
and ensure the constraint is trivially testable.

### 4. LOCKGATE_MESSAGE_JA is fixed

The user-facing rejection message for H01 is a **fixed string constant**.
Localising or customising it is intentionally prohibited — the legal
citation (`改正行政書士法§19`) and upgrade CTA URL
(`https://ssw-compass.jp/upgrade`) must not drift between deployments.

### 5. validateToolAnnotations is startup-required

`createMcpServer()` calls `validateToolAnnotations` before returning.
Any tool missing required HITL controls causes an immediate `throw`,
preventing Cloud Run from reaching a healthy state. This is intentional
— a misconfigured server must not serve L2/L3 traffic silently.

---

## Alternatives rejected

### A. Runtime-only enforcement (no startup validation)

A misconfigured annotation would only surface when the specific tool was
called by a Pro user. Rejected: production impact before detection.

### B. Per-request legalLevel lookup from a config file

Adding a config file would allow runtime changes without a deploy, which
is convenient but defeats the "annotation is the source of truth" design.
Rejected.

### C. UUID v4 for case_id

UUID v4 produces `/^[0-9a-f]{8}-[0-9a-f]{4}-4...$/` which is longer
(36 chars) and includes uppercase hex. nanoid base36 is shorter, URL-safe
without encoding, and matches v4 §3.4's regex. Rejected.

---

## Consequences

### Interface Freeze (Sprint 4 — do not change without a new ADR)

- `HitlControlId` enum (H01-H12 exactly as defined)
- `SswCompassToolAnnotation` shape (v2 existing fields + v4 additions)
- `LegalLevel` enum: `"L0" | "L1" | "L2" | "L3"`
- `assertHitlGate(auth, toolId, legalLevel)` signature
- `assertHitlGateRuntime(auth, toolId, staticLevel, runtimeLevel)` signature
- `LOCKGATE_MESSAGE_JA` string
- `CaseId` regex: `/^case_[a-z0-9]{16}$/`

### Testing

v4 §10.2 requires these test cases before Sprint 4 close:
- Free × L2 → HitlGateError (H01)
- Pro + no gyoseishoshi × L2 → HitlGateError
- Pro + gyoseishoshi × L2 → pass
- validateToolAnnotations: L2 without H01 → ConfigError
- validateToolAnnotations: L3 without requiresGyoseishoshiAuth → ConfigError
- per-call escalation: pdf_draft → L2 for Free → reject

---

## Related

- ADR-013: Auth (AuthContext — consumed by assertHitlGate)
- v4 §2: HITL 12 items spec
- v4 §4: L0-L4 legal level definitions
- sprint-4-plan.md §3.2: Interface Freeze

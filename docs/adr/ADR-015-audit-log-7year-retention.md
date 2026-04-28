# ADR-015: Audit log 7-year retention — GCS bucket_lock, no Firestore

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 6)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `infra/terraform/modules/audit-log/`, `apps/server/src/audit/`,
  `packages/shared-types/src/audit/`

---

## Context

v4 §2.5 (H04_AUDIT_LOG_7Y) requires 7-year retention for:
- L2/L3 tool invocations (approval, document generation)
- Actor identity (user_id_hash, tier, gyoseishoshi_number)
- Action type and case_id
- Input and output content hashes (not the content itself)
- Approval signatures (seal image hash for H03)

The legal basis is:
- 行政書士法 §9 業務帳簿義務 (7-year record-keeping requirement)
- APPI 越境移転回避 (avoid cross-border data transfer)

v4 §3.4 also mentions Firestore for `draft_content_hash` persistence to
enable re-verification ("承認済み draft が改竄されていないか"). This ADR
evaluates whether Firestore is necessary.

---

## Decision

### 1. GCS bucket_lock + Cloud Logging sink — no Firestore

Persistence surface: two layers.

**Layer 1 — Cloud Logging (online, queryable)**
- All `emitAuditEvent()` calls write structured JSON to the Cloud Run log stream.
- Cloud Logging retains 400 days by default.
- Supports structured queries: `jsonPayload.case_id="case_xxx"`,
  `jsonPayload.actor.tier="pro"`, `jsonPayload.action="draft_approved"`.
- Sprint 4 compliance query patterns all fit within 400 days.

**Layer 2 — GCS bucket_lock (archival, WORM)**
- Cloud Logging log sink exports to `gs://ssw-compass-audit-7y`.
- GCS bucket has `retention_period = 221184000` seconds (7 × 366 × 86400,
  leap-year-safe per sprint-4-plan §3.4 revision 8).
- `is_locked = true` — bucket cannot be deleted or shortened.
- Satisfies 行政書士法 §9 "7 年保存" requirement.

**`draft_content_hash` re-verification (why not Firestore)**

v4 §3.4 proposed Firestore for `draft_content_hash`. Analysis:
- The verification question is: "is this draft's hash the same as when it was
  approved?"
- The approved hash is already in the audit log event (`output_hash` field).
- Cloud Logging read-back by `case_id` returns the original audit event with
  the hash.
- No random-access DB is needed; Cloud Logging's structured query is sufficient.
- Firestore adds: second IAM surface, second asia-northeast1 SLA dependency,
  per-doc read cost that grows with audit volume.
- Decision: **GCS + Cloud Logging read-back satisfies all Sprint 4 verification
  requirements without Firestore**.

### 2. `AuditEvent` schema (frozen for Sprint 4)

Defined in `packages/shared-types/src/audit/AuditEvent.ts`.
Input and output content are **not stored** — only their sha256 hashes.
This satisfies APPI requirement (no 要配慮個人情報 stored) and 行政書士法 §9
(audit trail of actions, not content).

### 3. `emitAuditEvent()` is synchronous write via logger

`emitAuditEvent(event: AuditEvent): void` writes to `logger.info` with
`event: "audit_event"`. This is synchronous from the caller's perspective.
The Cloud Logging sink is async (eventual). This is acceptable because:
- The sink exports from Cloud Logging, not from the app.
- If the app crashes before export, Cloud Logging's in-flight buffer still
  captures the event.
- "Write BEFORE return content" is enforced in tool handlers (see H04 test).

### 4. GCS retention = 221,184,000 seconds

7 × 366 × 86400 = 221,184,000 (sprint-4-plan revision 8, leap-year-safe).
This is 7 years × 366 days to ensure no leap-year content falls outside
the retention window.

---

## Alternatives rejected

### A. Firestore for draft_content_hash

See Decision §1. All verification queries are satisfiable via Cloud Logging.
Firestore adds infrastructure complexity without necessity. Rejected.

### B. Cloud Logging alone (no GCS bucket_lock)

Cloud Logging's default retention is 400 days. 行政書士法 §9 requires 7 years.
Without the GCS sink, the archival requirement is unmet. Rejected.

### C. BigQuery export

BigQuery is suitable for analytics at scale but is over-engineered for Sprint 4
(~100 Pro users max). BigQuery also cannot be used with bucket_lock WORM semantics.
Rejected. Sprint 5+ can add a BigQuery sink in parallel.

### D. Application-level database (PostgreSQL/Supabase)

Would require a second persistence tier, connection pooling, backups,
and APPI compliance review. SSW has no database today. Rejected.

---

## Consequences

### GCS bucket `ssw-compass-audit-7y`

```hcl
retention_policy {
  retention_period = 221184000   # 7 × 366 × 86400 (leap-year-safe)
  is_locked        = true         # WORM — cannot shorten or delete
}
versioning { enabled = true }
public_access_prevention = "enforced"
uniform_bucket_level_access = true
```

**Warning**: `is_locked = true` is irreversible once `terraform apply` runs.
If the retention period needs adjustment afterward, it can only be
*increased*, never decreased.

### `fetchAuditEvents` for re-verification

```typescript
export async function fetchAuditEvents(filter: {
  case_id?: CaseId; tool_id?: string; since?: Date; limit?: number;
}): Promise<AuditEvent[]>
```

Implemented via Cloud Logging read-back (Cloud Logging API `entries.list`).
Used in integration tests and compliance queries. Sprint 4 implementation
reads from the Cloud Logging API; Sprint 5 can add GCS archive read-back
for events older than 400 days.

### Sprint 5 follow-up

GCS bucket exists but automated bucket lifecycle (transition to Coldline after
400 days) is deferred to Sprint 5. Current policy: all objects stay in Standard
storage for the full 7 years (sub-optimal cost but operationally simple).

---

## Related

- ADR-014: case_id generation (used in AuditEvent)
- ADR-013: AuthContext (actor tier + gyoseishoshi_number in AuditEvent)
- v4 §2.5: H04_AUDIT_LOG_7Y specification
- v4 §3.4: SubmitGyoseishoshiApproval — emitAuditEvent caller

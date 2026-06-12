# ADR-024: Approval state store — Supabase for HITL requestState

- **Status**: Accepted
- **Date**: 2026-06-12
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `supabase/migrations/`, `apps/server/src/approval/`

---

## Context

SSW Compass v2.1 adds MCP 2026-07-28 multi round-trip approval flows.
The flow needs an opaque `requestState` token, replay prevention, TOCTOU
checks, idempotent executor coordination, and multi-step parent approval
chains.

The invariant is stronger than the Sprint 4 audit-log use case:

- `pending → approved → executed | rejected | expired | escalated`
- atomic compare-and-set updates
- affected rows = 0 means replay, double approval, or expiry
- current draft hash must match the approved hash before execution

ADR-015 rejected Firestore/Supabase/BigQuery for the **audit log of record**.
That decision remains unchanged. Audit evidence continues to be Cloud Logging
exported to GCS WORM storage for 7-year retention.

---

## Decision

Use a dedicated SSW Compass Supabase project as the operational state store for
approval flows only.

### 1. Separation of concerns

- **Audit of record**: Cloud Logging → GCS bucket lock, unchanged from ADR-015.
- **Operational approval state**: Supabase Postgres tables `drafts` and
  `approval_requests`.

The Supabase rows are coordination state, not the legal audit archive.

### 2. No personal identifiers

`drafts` stores only:

- opaque `case_handle`
- `sha256` hash
- optional `storage_uri`
- status and expiry metadata

`approval_requests` stores only:

- opaque `requestState` id (`ars_` + base64url random 128-bit)
- `draft_id` and `draft_sha256`
- opaque principal
- step, status, idempotency key, expiry, and trace metadata

Residence card numbers, passport numbers, My Number, names, and full dates of
birth are not accepted by tool schemas and are not stored in these tables.

### 3. Atomic CAS

Application code performs state transitions with:

```sql
update approval_requests
set status = $next_status, decided_at = now()
where id = $id
  and status = 'pending'
  and expires_at > now();
```

The server treats zero affected rows as a failed transition. This gives replay,
double-approval, and expiry protection without self-contained JWT/JWE/HMAC
tokens.

### 4. RLS and service role

Both tables enable RLS, revoke default access from `anon`, `authenticated`, and
`public`, and grant access only to `service_role`.

The Supabase `service_role` key is used only from Cloud Run server code and must
never be exposed to MCP Apps UI resources or clients.

### 5. Region and secrets

The Supabase project should be provisioned in the Tokyo region where available.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured via Secret Manager
or deployment environment variables. `.env.example` contains empty names only.

---

## Consequences

### Positive

- The SQL contract in the v2.1 plan maps directly to Postgres.
- CAS semantics are easy to test and reason about.
- Read-only public tools remain independent of Supabase availability.
- The audit archive remains immutable and independent from operational state.

### Negative

- Supabase becomes a new external dependency for HITL and task workflows.
- ADR-015 readers may confuse audit storage and operational state; this ADR
  explicitly documents the boundary.

### Follow-up

- B3 wires `submit_gyoseishoshi_approval` to `approval_requests`.
- B4 stores package task metadata and draft hashes in Supabase.
- B8 verifies OAuth scope step-up before write-capable approval operations.

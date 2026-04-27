# ADR-010: Vertex AI Search ingestion failure-mode strategy

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 3 Batch 4)
- **Deciders**: @kabe, SSW Compass core team
- **Scope**: [scripts/ingest-sources.ts](../../scripts/ingest-sources.ts),
  [data/source-index.jsonl](../../data/source-index.jsonl),
  [infra/terraform/modules/vertex-ai-search/](../../infra/terraform/modules/vertex-ai-search/),
  [apps/server/src/vertex.ts](../../apps/server/src/vertex.ts).
- **Supersedes**: None. Co-dependent with
  [ADR-006 (Vertex fixture/real dispatch)](./ADR-006-vertex-fixture-real-dispatch.md)
  and [ADR-009 (Terraform foundation)](./ADR-009-terraform-foundation.md).

## Context

Batch 4 wires SSW Compass's `vertexSearch` function to real Vertex AI
Search (Discovery Engine). Three failure surfaces that fixture mode
hid become visible the moment `SSW_VERTEX_MODE=real` lands:

1. **`documentService.importDocuments` is an async LRO.** Per-document
   failures (fetch 404, MIME type reject, body too large) return
   `failureSamples[]` in the operation metadata but do not fail the
   operation overall. A run that "succeeds" with 38/40 docs ingested
   is a silent partial outage without explicit handling.

2. **Re-runs race with existing data store state.** Ingest is not
   idempotent by default — `reconciliationMode: INCREMENTAL` will add
   new docs, but running the same script twice could result in either
   duplicates or silent no-ops depending on `docId` collisions. No
   signal distinguishes "already ingested correctly" from "re-ingesting
   over the top unnecessarily".

3. **Rollback is non-obvious.** Once a bad document lands in a data
   store, it will be retrieved by every subsequent `search()` call
   until explicitly deleted. There is no `import --rollback` flag;
   recovery requires per-doc delete, data store recreate, or service-
   level fallback to fixture mode.

Without a codified strategy for these three, Sprint 5's scheduled
re-scrape would be the first place we learn about failure modes —
exactly the wrong time to learn about them. This ADR is the
pre-announcement.

## Decision

### 1. Partial-failure retry policy

The ingestion script classifies failures at two levels:

**Per-document fetch / hash stage** (before any Discovery Engine
call):

- `PERMANENT`: HTTP 4xx (404, 410), content-type not text/html or
  application/pdf, body size > 10 MiB, URL parse error.
  → log WARN; if `--mode=fail-fast` then abort run; if
  `--mode=best-effort` continue without the doc.
- `TRANSIENT`: HTTP 5xx, connection timeout (15s), DNS failure,
  TLS handshake failure.
  → exponential backoff retry: **30 s → 120 s → 300 s**. After 3
  failed retries, promote to PERMANENT.
- Success: compute SHA-256 of the normalised body, attach to entry.

**Per-data-store import stage** (LRO):

- The LRO metadata returns `successCount` and `failureCount`. If
  `failureCount > 0`, `failureSamples[]` contains up to 10
  reason strings.
- `--mode=fail-fast`: any `failureCount > 0` aborts the run (the
  source-index.jsonl is not written; SHA-256 stays at
  `__PLACEHOLDER__` for entries that would have succeeded too).
- `--mode=best-effort`: `failureSamples[]` are logged at WARN,
  entries whose docs did land get their `contentSha256` updated.

### 2. Deduplication via SHA-256

Before calling `importDocuments`, the script enumerates existing
documents in the target data store:

```typescript
documentServiceClient.listDocuments({
  parent: "projects/.../dataStores/<ds>/branches/0",
  pageSize: 1000,
})
```

For each source-index.jsonl entry:

- **Same `docId` + same content SHA-256** (read from `structData`):
  skip (no-op, logged DEBUG).
- **Same `docId` + different SHA-256**: treat as update. The
  importDocuments call with that `docId` replaces the document
  in place.
- **New `docId`**: regular import.

This keeps the run cost linear in "entries that actually need
ingesting" rather than always re-uploading everything.

### 3. Rollback strategy — three tiers

**Tier 1: per-document deletion.**
`documentServiceClient.deleteDocument({ name: "projects/.../documents/<docId>" })`.
Used when one specific document is known to be wrong (e.g., source URL
moved and the old cached content is misleading). Surgical, does not
disturb the other documents in the data store.

**Tier 2: data store recreate via Terraform.**
`terraform destroy -target=module.vertex_ai_search.google_discovery_engine_data_store.this["<ds>"]`
→ `terraform apply` to recreate empty → re-run `pnpm run ingest --filter=<ds>`.
Used when a data store is suspected of corruption / schema drift /
quota miscount. Preserves other data stores. Takes 1–2 minutes.

**Tier 3: env-flip `SSW_VERTEX_MODE=fixture`.**
```bash
gcloud run services update ssw-mcp-staging \
  --region=asia-northeast1 \
  --set-env-vars=SSW_VERTEX_MODE=fixture
```
Used when *any* Vertex-side issue is suspected (outage, quota
exhaustion, all data stores down, unknown root cause). Cloud Run is
back to fixture mode in one command, no Terraform round-trip, no
rebuild. Server behaviour is byte-identical to the pre-Batch-4
world. **Important: this is the same env-flip path as ADR-009
§Decision 6 mitigation #4 (staging-service delete) — it is a
runbook-level tool, not a Terraform-managed state change. Within
24 h the matching change must land in
[envs/staging/main.tf](../../infra/terraform/envs/staging/main.tf)
to re-align TF state and config.**

### 4. Monitoring

Cloud Logging filter, saved to operator bookmark:

```
resource.type="discoveryengine.googleapis.com/DataStore"
(severity>=WARNING OR jsonPayload.operation.error=*)
```

Log-based metric: `vertex_import_failure_count_24h` — counts log
entries matching the above filter in a rolling 24 h window.

Alert policy (Sprint 3 scope): email-only. When
`vertex_import_failure_count_24h > 0` sustained for 15 min, notify
`@kabe`. Slack webhook integration is deferred to Sprint 5+ per
ADR-009 §Decision 4 Secret Manager naming (reservation:
`slack-webhook-alerts`).

Post-ingest verification (runbook):

```bash
pnpm run ingest --dry-run --filter=visa_legal  # compute fresh SHA
# manually diff --dry-run output against current source-index.jsonl
# a diff means the upstream source changed; re-run without --dry-run
# to update.
```

### 5. `source-index.jsonl` schema addendum (reserved, not yet written)

For Sprint 5+ re-run cycles, the JSONL schema is extended with an
optional `status` field:

```typescript
const SourceEntrySchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1),
  url: z.string().url(),
  ministry: z.enum(["moj","mlit","mhlw","maff","meti","cao","soumu","ppc"]),
  datastore: z.enum(["visa_legal","visa_faq","visa_secondary"]),
  trustLevel: z.literal("primary_source"),
  tags: z.array(z.string()),
  lang: z.enum(["ja","en"]),
  verifiedAt: z.string(),      // ISO date
  contentSha256: z.string(),   // 64 hex chars or "__PLACEHOLDER__"
  notes: z.string().default(""),
  // --- reserved for ADR-010 future re-runs ---
  status: z.enum(["ok","failed"]).optional(),
  lastRunAt: z.string().optional(),          // ISO timestamp of last ingest attempt
  lastFailureReason: z.string().optional(),  // if status=failed
});
```

**Batch 4 does NOT write `status`.** Fail-fast mode in the initial
run means either all 40 succeed (no `status` needed) or the run
aborts (nothing written). First actual write happens in Sprint 5+
scheduled re-runs operating in best-effort mode. The optional
declaration makes the field backward-compat with current 40 entries
— no migration, no separate ADR needed. Consumers
(apps/server tool handlers) already ignore every field except
`datastore`; adding `status` does not affect runtime behaviour.

## Alternatives rejected

### A. Firestore-backed status table

A separate Firestore collection tracking per-URL ingestion status
instead of inline in source-index.jsonl. Rejected: adds a runtime
dependency (Firestore API enable + SA permissions), creates a second
source of truth that has to stay in sync with the JSONL, and blocks
the Sprint 3 closure on Firestore bootstrap. The inline optional
field matches the current convention and does not need any new
service.

### B. BigQuery audit log per run

Write every import operation's LRO metadata to a BigQuery table for
historical analysis. Rejected: over-engineered for one scheduled
re-scrape per week. Cloud Logging retention (30 d staging / 90 d
prod per ADR-009) holds enough history for any Sprint 3-4 debugging.
BigQuery-based audit can be a Sprint 6+ addition if volume grows.

### C. Destroy-and-recreate each run

Terraform destroy all 3 data stores and re-apply + re-ingest every
scheduled run. Simpler rollback model. Rejected: 2 + 2 = 4 min of
data-store downtime on every run; Discovery Engine quota limits on
data store creation / deletion per day; and the incremental mode
Discovery Engine already provides does the right thing cheaper.

### D. `--mode=overwrite` flag that always replaces existing docs

An explicit "nuke and redo" flag that does Tier 2 rollback inline.
Rejected: the existing `--filter=<ds>` + manual Tier 2 command is
two lines of runbook, and the blast radius deserves the manual
confirmation gate. No need for a flag that makes destruction
one-keystroke-easy.

## Consequences

### Positive

- Every ingestion failure has a classified, documented response
  path before Sprint 5's first unattended re-run.
- The env-flip Tier 3 rollback means a Vertex outage cannot take
  down SSW Compass — fixture mode is always 60 seconds away.
- The `status` field reservation means Sprint 5 can start writing
  re-run state immediately without needing a new ADR.

### Negative / follow-up

- The `listDocuments` + SHA-256 dedup adds O(N) calls per data
  store per run. For 40 docs this is negligible; if the catalogue
  grows past ~1000 docs, paginate or switch to a batched diff.
- Tier 2 rollback (destroy-recreate single data store) will
  momentarily fail `tools/call search_visa` if the targeted data
  store is the primary one. Tier 3 is the pre-emptive fix
  (flip to fixture first, then Tier 2).
- Alerting is email-only until Sprint 5+ Slack integration.
  Off-hours failures may go unresponded-to for up to 12 h.

## Verification performed

- Batch 4 Day 1: 3 data stores applied successfully via Terraform,
  verified via `discoveryengine.googleapis.com/v1/.../dataStores`
  REST endpoint (asia-northeast1 regional).
- Batch 4 Day 2 (pending): first ingestion run captures actual LRO
  operation IDs; this ADR's Verification section is finalised in
  Day 4 with those IDs inline.

## Related

- [ADR-006: Vertex fixture/real dispatch](./ADR-006-vertex-fixture-real-dispatch.md)
  — the dispatch contract this ADR builds on.
- [ADR-009: Terraform foundation](./ADR-009-terraform-foundation.md)
  — §Decision 6 mitigation #4 (Cloud Run service-delete as emergency
  stop) — structurally similar to Tier 3 env-flip used here.
- [.cursor/rules/deployment-checklist.mdc](../../.cursor/rules/deployment-checklist.mdc)
  — operator runbook; Tier 1/2/3 commands belong here for future
  human lookup.
- [docs/sprint-3-pending.md](../sprint-3-pending.md) — `Vertex AI
  Search 実接続` section is resolved by the Batch 4 deliverable;
  deletion happens in Day 4.

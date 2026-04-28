# ADR-010: Vertex AI Search ingestion strategy and Sprint 3–4 deferral

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 3 Batch 4 close)
- **Deciders**: @kabe, SSW Compass core team
- **Scope**:
  [scripts/ingest-sources.ts](../../scripts/ingest-sources.ts),
  [data/source-index.jsonl](../../data/source-index.jsonl),
  [data/url-health-report.2026-04-27.md](../../data/url-health-report.2026-04-27.md),
  [infra/terraform/modules/vertex-ai-search/](../../infra/terraform/modules/vertex-ai-search/),
  [apps/server/src/vertex.ts](../../apps/server/src/vertex.ts).
- **Supersedes**: An earlier Day-1 draft of this ADR that framed
  Batch 4 as a single-sprint full-ingest exercise. The Path B
  decision below is the accepted text.
- **Co-dependent**:
  [ADR-006 (Vertex fixture/real dispatch)](./ADR-006-vertex-fixture-real-dispatch.md),
  [ADR-009 (Terraform foundation)](./ADR-009-terraform-foundation.md).

## Context

Sprint 3 Batch 4 Day 1 enabled the Vertex AI Search foundation via
Terraform — three Discovery Engine data stores
(`visa_legal` / `visa_faq` / `visa_secondary`) were created empty
in `asia-northeast1` / `default_collection`, and
`roles/discoveryengine.viewer` was bound to the `ssw-runtime`
Cloud Run BYOSA. The two new APIs (`discoveryengine.googleapis.com`,
`aiplatform.googleapis.com`) were enabled.

Batch 4 Day 2 shipped [scripts/ingest-sources.ts](../../scripts/ingest-sources.ts)
implementing the failure-mode policy in §3 below. A dry-run check
was performed against the 40 entries in
[data/source-index.jsonl](../../data/source-index.jsonl) — a
quick parallel HEAD check with 10 concurrent requests and a 10 s
timeout, using `User-Agent: ssw-compass-ingest/1.0`, completed in
10.4 s. See [data/url-health-report.2026-04-27.md](../../data/url-health-report.2026-04-27.md)
for the full raw report.

**Headline finding**: 28 / 40 URLs returned 200 OK; **12 / 40
failed** (30 %). Per data store: `visa_legal` 23 / 34,
`visa_secondary` 5 / 5, `visa_faq` **0 / 1** — the FAQ data store
has no live seed content at all. Failure concentration by domain:
6 on moj.go.jp (subtree restructuring hypothesis), 3 on
meti.go.jp (timeout — bot-gating or TTFB hypothesis), 1 each on
maff.go.jp / mhlw.go.jp / mlit.go.jp.

The 30 % failure rate exceeds the 28 % threshold we had adopted
internally for "proceed with Sprint-3 full ingest". More importantly,
the 0 / 1 state of `visa_faq` means any real-mode query routed to
that data store would return empty — `SSW_VERTEX_MODE=real` with
the current seed would regress existing fixture-mode UX in the FAQ
tool path.

Sprint 1–2 seeded the 40 URLs as a quick lift before gyoseishoshi
retainer was in place. Sprint 3 is not the right moment to
unilaterally "fix" those URLs, because the questions surfaced by
this dry-run — subtree restructuring, bot-gating, ministry
coverage balance, visa_faq content scope — are business-content
questions, not engineering questions.

## Decision

### 1. Sprint 3 does not execute a real ingest.

The three Discovery Engine data stores remain **apply-complete but
content-empty** through Sprint 3 closure. The staging Cloud Run
service continues to run in `SSW_VERTEX_MODE=fixture`. The
60 / 60 vitest suite remains unchanged. Validation 9 of the
Batch 4 closure list (real-vertex reply) is deferred to Sprint 4
and explicitly marked "N/A Sprint 3" in the closure report.

Operationally:

```hcl
# infra/terraform/envs/staging/main.tf — stays as-is post Batch 4 Day 1
module "cloud_run" {
  env_vars = {
    SSW_ENV          = "staging"
    SSW_VERTEX_MODE  = "fixture"   # NOT flipped to "real" in Sprint 3
    LOG_LEVEL        = "info"
    SSW_BUILD_SOURCE = "batch-2-placeholder"  # will roll forward with future deploys
  }
}
```

The data stores accrue a near-zero monthly cost (< 10 GiB free tier
for storage, zero query volume) and stay ready for the Sprint 4
ingest without further Terraform work.

### 2. Sprint 4 integrates URL cleanup with gyoseishoshi supervision.

`docs/sprint-4-pending.md` Phase 1 captures the work. Summary:

- Present [data/url-health-report.2026-04-27.md](../../data/url-health-report.2026-04-27.md)
  to the retained gyoseishoshi.
- 12 dead URLs: replace with the semantically-equivalent surviving
  page (for moj.go.jp subtree restructuring cases) or remove
  entirely (for retired pages), logged per-URL in the next dated
  health report.
- 28 live URLs: confirm authority / recency / coverage adequacy.
- Expand `source-index.jsonl` past 50 entries with **a minimum of
  10 entries in `visa_faq`** and **≥ 2 entries per 特定技能分野**.
  Current moj-heavy 40 % distribution remains defensible for legal
  base coverage but non-moj sector ministries need thickening.
- Run [scripts/ingest-sources.ts](../../scripts/ingest-sources.ts)
  in `--mode=best-effort`, accept any residual PERMANENT failures
  as reviewed-and-intentional.
- Flip `SSW_VERTEX_MODE=real` on staging and re-verify all smoke
  and integration paths.

### 3. Ingestion script retry / dedup / rollback policy (carried forward from the Day-1 draft)

**Per-document fetch stage:**

- `PERMANENT` failure → HTTP 4xx, unsupported content-type, body
  > 1 MiB, URL parse error. Log WARN. Under `--mode=fail-fast`
  abort the run; under `--mode=best-effort` continue without the
  doc.
- `TRANSIENT` failure → HTTP 5xx, connection timeout (15 s), DNS
  failure, TLS handshake failure. Exponential backoff retry at
  **30 s → 120 s → 300 s**. After 3 failed retries, promote to
  `PERMANENT`.
- Success → SHA-256 of the normalised body attached to the entry.

**Per-data-store import stage (LRO):**

- `successCount` and `failureCount` from the operation metadata
  are logged at INFO and WARN respectively, along with up to 10
  `failureSamples[]` reasons.
- `--mode=fail-fast` → any `failureCount > 0` aborts and does
  NOT rewrite the JSONL (SHA stays `__PLACEHOLDER__`).
- `--mode=best-effort` → entries whose documents landed get their
  `contentSha256` updated; entries whose documents failed are
  logged and carried over without change.

**Dedup** via SHA-256 — before import, `documentServiceClient.listDocuments`
enumerates the existing data store. Same `docId` + same hash →
skip. Same `docId` + different hash → update. New `docId` → import.

**Rollback** in three tiers:

- Tier 1 — **per-document delete**. Surgical.
  `documentServiceClient.deleteDocument({ name: "projects/.../documents/<docId>" })`.
- Tier 2 — **data store recreate via Terraform**.
  `terraform destroy -target=module.vertex_ai_search.google_discovery_engine_data_store.this["<ds>"]` → `terraform apply` → `pnpm run ingest --filter=<ds>`.
  Preserves other data stores; ≈ 2 minutes downtime on the targeted one.
- Tier 3 — **env-flip `SSW_VERTEX_MODE=fixture`**.
  `gcloud run services update ssw-mcp-staging --set-env-vars=SSW_VERTEX_MODE=fixture`.
  One command; server byte-identical to pre-Batch-4 behaviour. Used for any
  suspected Vertex-side issue. Within 24 h the matching
  change must land in [envs/staging/main.tf](../../infra/terraform/envs/staging/main.tf)
  to re-align TF state and config.

### 4. URL health check methodology (codified)

The pre-ingest health check is **always** a first-class step, not
only before Sprint 4 ingest but also Sprint 5+ re-scrape cycles.

Canonical invocations:

```bash
# Full dry-run with SHA-256 compute + per-entry diff report.
# Recommended for every session. Slower (~ N × average fetch time).
pnpm run ingest -- --dry-run --mode=best-effort

# Quick pass/fail only. Used when scanning upstream availability.
# Parallel, 10 concurrent, 10 s timeout. See ADR-010 §4 sample in
# data/url-health-report.2026-04-27.md for the inline Python.
```

Every Sprint kickoff (or ad-hoc when suspicion triggers — e.g. a
production grounding result visibly drifts) runs the quick
pass/fail, writes the output to
`data/url-health-report.YYYY-MM-DD.md`, commits it, and hands it
to the gyoseishoshi for review. The file name is date-stamped
rather than rotating so a chronological trail exists before the
Sprint 5 scheduled cron lands. The legacy report at
`data/url-health-report.2026-04-27.md` is the first entry in that
trail.

### 5. `source-index.jsonl` schema addendum (reserved, not yet written)

For Sprint 5+ re-run cycles, an optional `status` field is
reserved. Batch 4 does NOT write it.

```typescript
const SourceEntrySchema = z.object({
  // ... existing 11 fields ...
  status:            z.enum(["ok", "failed"]).optional(),
  lastRunAt:         z.string().optional(),  // ISO timestamp
  lastFailureReason: z.string().optional(),  // set when status==="failed"
});
```

The optional declaration is backward-compat with the current 40
entries. Production MCP server consumers only read `datastore` and
ignore all other fields.

## Alternatives rejected

### A. Path A — best-effort partial ingest in Sprint 3

Proceed with `--mode=best-effort` now, ingest the 28 surviving URLs
across the three data stores, flip `SSW_VERTEX_MODE=real`, accept
that `visa_faq` returns empty. Rejected because:

- `visa_faq` at 0 entries creates a real-mode UX regression: the
  FAQ tool path refuses-and-redirects for every query, degrading
  from the fixture mode's canned-but-plausible answer.
- Individual moj.go.jp URL fixes before the gyoseishoshi-informed
  subtree-restructuring review would likely be thrown away at
  Sprint 4 start and redone correctly.
- Sprint 3's quality bar (adoption-readiness for Sprint 4 external
  submission) is misaligned with a partial-state staging.

### B. Quick health-check then retry in Batch 8

Defer the problem to Sprint 3's closing batch and attempt a
cleanup sprint at the end. Rejected because:

- Batch 8's scope is Sprint 3 closure and Sprint 4 handoff, not
  content-authoring. Shoehorning URL cleanup there compresses the
  closure work and re-introduces the gyoseishoshi-supervision
  question anyway.
- Sprint 4's first phase is already dedicated to this work. No
  advantage to squeezing it earlier.

### C. Retroactively strengthen the Sprint 1–2 seeding methodology

The 40 URLs were seeded before gyoseishoshi retainer was in place.
In principle, the seeding ADR could be revised to require
health-check-before-merge. Rejected for Sprint 3 scope:

- Retroactive changes to past decisions are out of scope.
- A Sprint 5+ "seeding and re-scrape ADR" is the right place for
  the forward-looking convention. Sprint 3 does not have to solve
  it today.

## Consequences

### Positive

- Sprint 3 closes with a **clean separation** between engineering
  (TF / Cloud Run / CI-CD / CSP / DLP / sanitizer / VPC / Cloud
  Armor — all engineering-authored) and content (URL health /
  ministry coverage / visa_faq scope — gyoseishoshi-authored).
  No engineering batch needs to block on content judgement.
- The ingestion script, TF modules, and IAM surface are all built
  and byte-identical ready for Sprint 4 to pick up.
- Staging Cloud Run's current 60 / 60 smoke-passing fixture mode
  is preserved unchanged — ADR-009 §6's public-exposure window
  still closes in Batch 6 as scheduled, independent of Vertex
  real-mode.
- The health report is a tangible Sprint-4 hand-off artefact
  rather than an agent-produced analysis that evaporates after the
  Sprint 3 session.

### Negative / follow-up

- Sprint 4 scope grows by one week: URL cleanup + 50+ expansion +
  gyoseishoshi session + full ingest + real flip + verification.
  Sprint 4 target (Connectors Directory submission) may shift from
  end-June to second week of July. This is recorded in
  `docs/sprint-4-pending.md`.
- Staging continues to run with fixture-mode answers, meaning
  external verifiers (Batch 7 6-host verification) see fixture
  content rather than real Vertex retrievals. The verification
  still exercises every other surface (tool schemas, PII guards,
  output sanitizer once it flips, CSP, DLP, disclaimer injection).
  Real-retrieval verification is deferred into Sprint 4 Phase 1
  exit criterion.
- `data/source-index.jsonl` stays unedited in Sprint 3. If another
  batch (or hotfix) tries to edit it, it must be explicitly flagged
  as a scope violation.

## Related

- [ADR-006: Vertex fixture/real dispatch](./ADR-006-vertex-fixture-real-dispatch.md)
  — the dispatch seam that makes today's deferral essentially free.
- [ADR-009: Terraform foundation](./ADR-009-terraform-foundation.md)
  §Decision 6 mitigation #4 (service delete) — architectural cousin
  of Tier 3 env-flip.
- [data/url-health-report.2026-04-27.md](../../data/url-health-report.2026-04-27.md)
  — the artefact this ADR hands off to Sprint 4.
- [docs/sprint-3-pending.md](../sprint-3-pending.md) — "Vertex AI
  Search 実接続" section removed as resolved by this ADR.
- [docs/sprint-4-pending.md](../sprint-4-pending.md) — Phase 1 picks
  up the deferred work.

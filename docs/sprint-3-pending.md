# Sprint 3 Pending — closure

Sprint 3 delivered the production-hardening foundation. All items
that were "pending" at Sprint 1 close have either been resolved in
Sprint 3 or explicitly migrated to Sprint 4. This file is retained
as a **Sprint 3 closure artefact** — the history of what was
originally deferred here and where each item ended up.

> **Status (2026-04-28)**: all Sprint 3 batches complete. Sprint 3
> closure summary lives in [sprint-3-summary.md](sprint-3-summary.md)
> (Batch 8). Active Sprint 4 scope lives in
> [sprint-4-pending.md](sprint-4-pending.md).

## Disposition of originally-pending items

### CSP hash migration → **resolved in Batch 5 Commit 3**

Post-build script [scripts/compute-csp-hashes.mjs](../scripts/compute-csp-hashes.mjs)
invoked as `postbuild` on each `ui/ssw-<name>/package.json`. All 4
UI `dist/mcp-app.html` bundles now ship with
`Content-Security-Policy-Report-Only` including
`'sha256-<hash>'` per inlined `<script>` / `<style>` block,
`'strict-dynamic'`, `require-trusted-types-for 'script'`, and
`trusted-types ssw-purify dompurify`. TODO(sprint-3) comments
removed from all 4 source files. Enforce flip deferred to Sprint 4
per ADR-012 §Decision 1 rollout sequencing.

### SDK type bug bypass → **deferred to Sprint 4 (ADR-011 candidate)**

`apps/server/src/index.ts:62` `@ts-expect-error` remains in place.
`@modelcontextprotocol/sdk` latest as of 2026-04-28 = 1.29.0 (no
1.30.0 release). Monitoring continues in Sprint 4; removal follows
the same pattern documented in the original entry.

### Cloud DLP integration → **resolved in Batch 5 Commit 2 (feature gated off in Batch 6)**

[apps/server/src/pii/dlp-client.ts](../apps/server/src/pii/dlp-client.ts)
implements the second stage behind `DLP_ENABLED` env flag. 7 vitest
cases in [dlp.test.ts](../apps/server/test/pii/dlp.test.ts) cover
disabled / enabled / fail-closed / timeout / project-resolution paths.
Batch 6 close surfaced a false-positive on Japanese text with default
`minLikelihood=POSSIBLE` (blocked the neutral smoke query "特定技能1号
建設分野"); `DLP_ENABLED=false` on staging pending Sprint 4 sensitivity
tuning. Unit coverage unchanged. ADR-011 candidate for the tuning work.

### Output sanitizer activation → **resolved in Batch 5 Commit 1**

`SANITIZATION_ACTIVE = true` flipped in
[apps/server/src/safety/output-sanitizer.ts](../apps/server/src/safety/output-sanitizer.ts).
11 snapshot cases in
[sanitizer.snapshot.test.ts](../apps/server/test/safety/sanitizer.snapshot.test.ts)
(vitest count 60 → 71). Known weakness in pattern-application order
(soft-hyphen smuggling) documented in the test body as a reserved
hardening target. ADR-011 candidate.

### source-index.jsonl SHA-256 population and 50+ expansion → **migrated to Sprint 4 Phase 1 (ADR-010 Path B)**

Batch 4 Day 2 URL health check found 12/40 dead URLs (30 %). Above
the 28 % threshold we internally adopted for Sprint-3 full ingest.
ADR-010 Path B adopted: Sprint 3 ships an empty data store set,
ingestion script, retry/dedup/rollback policy. Sprint 4 Phase 1 does
the gyoseishoshi-supervised URL cleanup + 50+ expansion + full
ingest + `SSW_VERTEX_MODE=real` flip as one integrated session. See
[data/url-health-report.2026-04-27.md](../data/url-health-report.2026-04-27.md)
and [docs/sprint-4-pending.md](sprint-4-pending.md) Phase 1.

### SSW logo finalize → **deferred to Sprint 4 Phase 2**

Logo remains a placeholder — AI generation is out of scope per
Sprint 2 kickoff prompt; commissioned design is a Sprint 4 human
task. Tracking in
[docs/sprint-4-pending.md](sprint-4-pending.md) Phase 2.

### 6-host verification (Batch 7) → **backend smoke resolved; per-host UX verification in progress**

Batch 7 Commit 2 added a 5th smoke stage exercising
`resources/read ui://ssw-search/mcp-app.html` against the
ID-token-gated Cloud Run staging. All 5 backend checks green in
cd-staging run `25031985199` (post-PR #19 merge). Human per-host
UX verification tracked in
[docs/host-verification-report.md](host-verification-report.md);
hosts that cannot be completed in Sprint 3 migrate to Sprint 4
Phase 3 per ADR-012 §Consequences.

## Closure grep (Batch 8 kickoff verification)

Expected exit states:

```bash
# 1. No Sprint-3 TODO markers in any source file.
grep -rn 'TODO(sprint-3)' --include='*.html' --include='*.ts' \
  --include='*.tsx' --exclude-dir=dist apps/ ui/ packages/
#   → zero matches

# 2. Every Sprint 3 ADR numbered 008-012.
ls docs/adr/ADR-00{8,9}*.md docs/adr/ADR-01{0,1,2}*.md 2>/dev/null \
  | wc -l
#   → 5 (008 process.env, 009 TF foundation, 010 Vertex, 011 not
#        yet written [sanitizer/DLP hardening candidate], 012 egress +
#        public exposure)

# 3. No committed reference to the live staging or prod URL.
git grep -iE 'ssw-mcp-(staging|prod)-[a-z0-9]+[-.][a-z0-9-]+\.(a\.)?run\.app' \
  -- ':!docs/adr/*' ':!data/url-health-report*'
#   → zero matches (ADR-012 §Ongoing guards)
```

## How this file is used going forward

Sprint 3 closure means this file **stops being a live workqueue**.
Future contributors reading it get historical context:

- What was pending at Sprint 1 close (§Disposition above lists the
  6 original entries).
- Where each landed (resolved in Batch X / deferred to Sprint 4).
- Grep commands to confirm the closure at any future checkpoint.

Active Sprint 4 work is in
[docs/sprint-4-pending.md](sprint-4-pending.md). Post-Sprint-4
retrospective items will live in a (yet-unwritten) `sprint-4-summary.md`.

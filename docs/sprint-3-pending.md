# Sprint 3 Pending Tasks

Grep-indexed checklist of technical debt deliberately deferred from Sprint 1
to Sprint 3. Each section gives the discovery command, the expected hit
count at Sprint 1 close (2026-04-27), and the resolution plan. Run the
commands at Sprint 3 kickoff to re-confirm scope.

## CSP hash migration

**Discovery:**

```bash
grep -rn 'TODO(sprint-3)' --include='*.html' --include='*.ts' --include='*.tsx' \
  apps/ ui/ packages/
```

**Expected result at Sprint 2 close (verified 2026-04-27):**

```
ui/ssw-checklist/dist/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-checklist/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-timeline/dist/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-timeline/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-classify/dist/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-classify/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-search/dist/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
ui/ssw-search/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
```

8 hits = 4 UI Resources (`ssw-search`, `ssw-classify`, `ssw-timeline`,
`ssw-checklist`) × (source `mcp-app.html` + built `dist/mcp-app.html`).
The doc originally expected 1 hit against `ssw-search` only; Sprint 2
Batch 2–5 added the three sibling UIs with the same boilerplate CSP
`meta` tag, each carrying the same `TODO(sprint-3)` marker by design.
To exclude build artifacts, re-run with `--exclude-dir=dist`; the
source-only count should be 4.

**Resolution plan:**

- Implement the post-build hash script described in v2 §6.2 **once**
  as a shared helper (e.g. `scripts/post-build-csp-hash.mjs` or a
  `@ssw/ui-bridge` build step), then invoke it from each of the 4
  `ui/ssw-*/package.json` `postbuild` hooks. Do not copy-paste the
  logic per UI.
- Per UI: read `ui/ssw-*/dist/mcp-app.html`, compute `sha256-*` for
  every inlined `<script>` and `<style>` block, rewrite the CSP `meta`
  tag to replace `'unsafe-inline'` with those hashes + `'strict-dynamic'`.
- Follow v3 §23 rollout: CSP `Content-Security-Policy-Report-Only`
  header for 1 sprint of observation, then flip to enforcing
  `Content-Security-Policy`.
- Add Trusted Types (`require-trusted-types-for 'script'; trusted-types
  ssw-purify;`) once DOMPurify is instantiated with
  `RETURN_TRUSTED_TYPE: true`.
- Remove the `TODO(sprint-3)` comment from all 4 source `mcp-app.html`
  files as part of the same commit so the Sprint 3 close-check grep
  (source-only, `--exclude-dir=dist`) returns zero.

## SDK type bug bypass

**Discovery:**

```bash
grep -rn '@ts-expect-error' --include='*.ts' --include='*.tsx' \
  apps/ ui/ packages/
```

**Expected result at Sprint 1 close (verified 2026-04-27):**

```
apps/server/src/index.ts:62:        // @ts-expect-error: SDK Transport interface declares onclose?: () => void,
```

1 hit. The comment body explains the SDK type mismatch
(`(() => void) | undefined` vs `() => void` under
`exactOptionalPropertyTypes: true`). Upstream: Issue #1314,
PR #1766 / #1821.

**Resolution plan:**

- Monitor `@modelcontextprotocol/sdk` releases. The fix is expected in
  1.30.0 once PR #1766 (or the more comprehensive PR #1821) lands.
- When upgrading, remove the `@ts-expect-error` + its 2 comment lines.
  `tsc` will raise `TS2578: Unused '@ts-expect-error' directive` if the
  underlying error is gone — the unused-directive error is the
  safety net that proves removal is correct.
- If 1.30.0 ships with a different fix path (e.g. relaxing
  `strictNullChecks` internally), re-read `ADR-002`-style and update
  this file accordingly.

## Cloud DLP integration

**Discovery:**

```bash
grep -rn 'scrubInputForPII' --include='*.ts' apps/
```

**Expected result at Sprint 2 close (verified 2026-04-27):**

```
apps/server/src/pii/index.ts:45:export async function scrubInputForPII(args: unknown): Promise<PiiScrubResult> {
apps/server/src/tools/classify-procedure/handler.ts:5,21        (import + call)
apps/server/src/tools/get-deadline-timeline/handler.ts:5,20     (import + call)
apps/server/src/tools/list-visa-documents/handler.ts:5,14       (import + call)
apps/server/src/tools/search-visa/handler.ts:5,15               (import + call)
apps/server/test/pii/scrub.test.ts                              (10 occurrences — core regex-stage cases)
apps/server/test/tools/classify-procedure/prompts.test.ts       (4 occurrences — PII guard tests)
apps/server/test/tools/get-deadline-timeline/prompts.test.ts    (4 occurrences — PII guard tests)
apps/server/test/tools/list-visa-documents/prompts.test.ts      (3 occurrences — PII guard tests)
```

30 total hits: 1 definition in `pii/index.ts` + 4 production call sites
(one per tool handler, each with a matching import line = 8 handler
hits) + 21 vitest occurrences across 4 test files. Sprint 1 shipped
with only `search_visa`; Sprint 2 Batches 3–5 added `classify_procedure`,
`get_deadline_timeline`, and `list_visa_documents`, each with the
same `scrubInputForPII` guard at the top of its handler and a paired
PII-smuggling prompt test. The call-site contract is
`Promise<PiiScrubResult>` and will not change when DLP is wired in.

**Resolution plan:**

- Add the Cloud DLP second stage inside `apps/server/src/pii/index.ts`,
  gated behind a `DLP_ENABLED` env flag for Sprint 3 staged rollout.
- Implementation follows v2 §7.1: `@google-cloud/dlp` client +
  `inspectContent` with the existing `BLOCKING_TYPES` set + the
  `ZAIRYU_CARD_NUMBER` custom infoType regex.
- Call site in `handler.ts` remains untouched. Add new vitest cases in
  `test/pii/scrub.dlp.test.ts` using mocked DLP responses.
- BLOCKING_TYPES modification requires a paired ADR (security.mdc rule).

## Output sanitizer activation

**Discovery:**

```bash
grep -rn 'SANITIZATION_ACTIVE' --include='*.ts' apps/
```

**Expected result at Sprint 1 close (verified 2026-04-27):**

```
apps/server/src/safety/output-sanitizer.ts:7: * stable SanitizeResult shape today; Sprint 3 flips SANITIZATION_ACTIVE to
apps/server/src/safety/output-sanitizer.ts:16:const SANITIZATION_ACTIVE = false;
apps/server/src/safety/output-sanitizer.ts:38:  if (!SANITIZATION_ACTIVE) {
```

3 lines in the sanitizer file. Pattern set (`INJECTION_PATTERNS`,
`SUSPICIOUS_URL`, `CODE_FENCE`, `CONTROL_CHARS`) is already complete;
flipping the flag activates it without any further pattern work.

**Resolution plan:**

- Create `apps/server/test/safety/sanitizer.snapshot.test.ts` with
  golden outputs for each pattern category (injection, external URL
  neutralization, code fence removal, bidi / zero-width stripping).
  This is mandatory per `.cursor/rules/security.mdc`: every sanitizer
  change must be paired with a snapshot test update.
- Flip `SANITIZATION_ACTIVE = true` in the same commit. The pass-through
  branch becomes dead code — remove it in a follow-up commit once the
  snapshot suite has been green for one sprint.
- Monitor `logger.warn({ event: "retrieved_content_sanitized" })` volume
  in Cloud Logging after Sprint 3 deploy; tune patterns if the
  false-positive rate on primary-source `*.go.jp` content exceeds 1 %.

## source-index.jsonl SHA-256 population and 50+ expansion

**Status (Sprint 3 Batch 4 close):** migrated to Sprint 4 per
[ADR-010 Path B](./adr/ADR-010-vertex-ingestion-failure-mode.md).

**Discovery:**

```bash
wc -l data/source-index.jsonl
grep -c '"contentSha256":"__PLACEHOLDER__"' data/source-index.jsonl
```

**Status 2026-04-28 (Batch 4 close):**

```
40 data/source-index.jsonl
40   # all contentSha256 still __PLACEHOLDER__ (Path B: no Sprint 3 edits)
```

Batch 4 Day 1 created the three Discovery Engine data stores via
Terraform (`visa_legal` / `visa_faq` / `visa_secondary`) and bound
`roles/discoveryengine.viewer` to `ssw-runtime`. Batch 4 Day 2
shipped [scripts/ingest-sources.ts](../scripts/ingest-sources.ts)
with full `--dry-run` / `--filter` / `--mode` flags.

A URL health dry-run at Batch 4 Day 2 found 12 of the 40 seeds
(30 %) dead — including the only `visa_faq` entry — which exceeded
the 28 % threshold we had adopted for Sprint-3 full ingest. Rather
than band-aid the seeds unilaterally the work migrates to Sprint 4
Phase 1 where the retained gyoseishoshi drives the URL cleanup +
50+ expansion in one sitting. Report at
[data/url-health-report.2026-04-27.md](../data/url-health-report.2026-04-27.md).

**What Sprint 3 already delivered toward this goal:**

- Discovery Engine data stores 3 × in `asia-northeast1`
  / `default_collection` (apply-complete, empty).
- `ssw-runtime` BYOSA bound to `roles/discoveryengine.viewer`.
- [scripts/ingest-sources.ts](../scripts/ingest-sources.ts) with
  retry policy per ADR-010 §3.
- ADR-010 retry / dedup / rollback policy documented.
- Baseline health report at
  [data/url-health-report.2026-04-27.md](../data/url-health-report.2026-04-27.md).

**Exit criterion (moved to Sprint 4):**

- `grep -c '"contentSha256":"__PLACEHOLDER__"' data/source-index.jsonl` = 0
- `wc -l data/source-index.jsonl` ≥ 50
- `visa_faq` data store has ≥ 10 entries
- Each 特定技能分野 has ≥ 2 entries across data stores
- Staging `SSW_VERTEX_MODE=real` smoke passes for each tool

Tracking in [docs/sprint-4-pending.md](./sprint-4-pending.md) Phase 1.

## SSW logo finalize (Sprint 3 / 4)

**Discovery:**

```bash
grep -l 'placeholder' assets/logo/*.svg
```

**Expected result at Sprint 2 close (verified 2026-04-27):**

```
assets/logo/ssw-logo.svg
```

1 hit. The SVG's `aria-label` contains the word `"placeholder"` by design
so automated review catches it before Sprint 4 submission.

**Resolution plan:**

- Sprint 3 kickoff: commission a human-designed monoline SVG (compass
  needle + torii, depth-blue `#0A2540`) per v3 §A. AI generation is
  explicitly out of scope for the logo per the Sprint 2 kickoff prompt.
- Drop the final file at `assets/logo/ssw-logo.svg`; follow the procedure
  in `assets/logo/README.md`.
- Add dark-mode / monochrome variants if the final asset is not
  colour-independent.
- Grep exit criterion: `grep -l 'placeholder' assets/logo/*.svg` returns
  no files.
- Reference the final logo from (a) Anthropic + OpenAI submission packets
  (Sprint 4), (b) the hero section of the root `README.md`, and
  (c) optionally UI chrome if a SSW badge is ever rendered inside a
  resource.

---

## How to use this file

- At Sprint 3 kickoff, re-run every grep command above.
- If the result for a section is unchanged, proceed with the listed
  resolution plan.
- If the result differs from "expected", read the diff carefully: new
  hits may mean other work introduced new debt, and missing hits may
  mean the item was silently resolved (in which case: delete the
  section).
- After each item is resolved, delete that section from this file so
  the document shrinks to zero by Sprint 3 close.

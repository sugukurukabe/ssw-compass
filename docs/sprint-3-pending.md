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

## Vertex AI Search 実接続 (Sprint 2 で着手、Sprint 3 で本番化)

**Discovery:**

```bash
grep -rn 'fixture' --include='*.ts' apps/server/src/vertex.ts
```

**Expected result at Sprint 2 close (verified 2026-04-27):**

```
apps/server/src/vertex.ts:7: * - "fixture" (default): returns hardcoded primary_source entries from
apps/server/src/vertex.ts:14: *   any one throws immediately (silent fallback to fixture is rejected
apps/server/src/vertex.ts:48:type VertexMode = "fixture" | "real";
apps/server/src/vertex.ts:77:  return raw === "real" ? "real" : "fixture";
apps/server/src/vertex.ts:105:        "Set them or switch back to SSW_VERTEX_MODE=fixture for local development.",
apps/server/src/vertex.ts:118:async function fixtureSearch(args: VertexSearchArgs): Promise<VertexSearchResult> {
apps/server/src/vertex.ts:257:  if (mode === "fixture") {
apps/server/src/vertex.ts:258:    return fixtureSearch(args);
```

8 hits. Sprint 1 shipped a single-line docstring stub; Sprint 2 Batch 6
landed real-dispatch per [ADR-006](./adr/ADR-006-vertex-fixture-real-dispatch.md),
so the file now contains both the `"fixture" | "real"` discriminator
type, the runtime switch at line 257–258, and the module docstring
contrast (fixture as default, real gated on `SSW_VERTEX_MODE=real`).
The `fixtureSearch` function body is retained for local development
and offline test runs — it is not dead code and must not be removed
in Sprint 3.

**Resolution plan:**

Sprint 2 "initial wiring" is **complete** (ADR-006). The only remaining
Sprint 3 work is the production-hardening half:

- Add egress controls: VPC connector + Cloud NAT static IP +
  application-layer URL allowlist (`safeFetch`) per v3 §23.2.
- Add retriever / writer separation per v2 §10 for content integrity
  (prevents the writer role from poisoning the retrieved index).
- Verify the output sanitizer (see previous section) runs between
  `vertexSearch` and the structured response before Sprint 3 close.
- Flip the production default from `fixture` to `real` by setting
  `SSW_VERTEX_MODE=real` in the Cloud Run service spec (Batch 3),
  keeping `fixture` as the local-dev default to avoid accidental
  Vertex calls from `pnpm dev`.
- Exit criterion: `SSW_VERTEX_MODE=real` run of the vitest suite
  against real data stores returns non-empty results with
  `confidence >= 0.7` on the canonical test queries.

## source-index.jsonl expansion to 50+ entries + real SHA-256 population

**Discovery:**

```bash
wc -l data/source-index.jsonl
grep -c '"contentSha256":"__PLACEHOLDER__"' data/source-index.jsonl
```

**Expected result at Sprint 2 close (verified 2026-04-27):**

```
40 data/source-index.jsonl
40
```

40 entries total, all with `contentSha256: "__PLACEHOLDER__"`. Sprint 2
Batch 6 shipped the seed at 40; Sprint 2 kickoff targeted 50+.

**Resolution plan (Sprint 3):**

- Add the remaining 10+ entries from the gyoseishoshi monthly review cadence
  once each real URL is verified (deep-link level, not just ministry-top).
- Implement the ingest pipeline that reads `data/source-index.jsonl`,
  fetches each URL, computes SHA-256 of the normalised body, and replaces
  the `__PLACEHOLDER__` value in place via a commit.
- Pair with Terraform data store provisioning
  (`visa_legal` / `visa_faq` / `visa_secondary`) per v2 §10.
- Sprint 3 close exit criterion: the second grep above should return
  `0` (all placeholders replaced with real hashes).

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

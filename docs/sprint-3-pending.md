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

**Expected result at Sprint 1 close (verified 2026-04-27):**

```
ui/vcj-search/mcp-app.html:7:      TODO(sprint-3): Replace 'unsafe-inline' with sha256 hashes.
```

1 hit. `dist/mcp-app.html` is a build artifact and should not be grepped;
if you need to include it add `--include='*.html'` without the path filter
or grep `dist/` separately.

**Resolution plan:**

- Implement the post-build hash script described in v2 §6.2. It reads
  `ui/vcj-search/dist/mcp-app.html`, computes `sha256-*` for every
  inlined `<script>` and `<style>` block, and rewrites the CSP `meta`
  tag to replace `'unsafe-inline'` with those hashes + `'strict-dynamic'`.
- Follow v3 §23 rollout: CSP `Content-Security-Policy-Report-Only`
  header for 1 sprint of observation, then flip to enforcing
  `Content-Security-Policy`.
- Add Trusted Types (`require-trusted-types-for 'script'; trusted-types
  vcj-purify;`) once DOMPurify is instantiated with
  `RETURN_TRUSTED_TYPE: true`.
- Remove the `TODO(sprint-3)` comment as part of the same commit so the
  Sprint 3 close-check grep returns zero.

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

**Expected result at Sprint 1 close (verified 2026-04-27):**

```
apps/server/src/pii/index.ts:45:export async function scrubInputForPII(args: unknown): Promise<PiiScrubResult> {
apps/server/src/tools/search-visa/handler.ts:5:import { scrubInputForPII } from "../../pii/index.js";
apps/server/src/tools/search-visa/handler.ts:15:    const piiCheck = await scrubInputForPII(args);
apps/server/test/pii/scrub.test.ts  (7 occurrences — test cases)
```

One production call site in `handler.ts`, one definition in `pii/index.ts`,
plus 7 vitest cases. The call-site contract is `Promise<PiiScrubResult>`
and will not change when DLP is wired in.

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

**Expected result at Sprint 1 close (verified 2026-04-27):**

```
apps/server/src/vertex.ts:2: * Vertex AI Search client — Sprint 1 fixture stub.
```

1 hit — the module-level docstring identifying the fixture nature. The
actual fixture data array lives in the same file (search for
`FIXTURE_CHUNKS` if needed).

**Resolution plan (split across two sprints):**

Sprint 2 (initial wiring):

- Replace `FIXTURE_CHUNKS` with `@google-cloud/discoveryengine` client
  calls against the `visa_legal` data store.
- Preserve the `VertexSearchArgs` / `VertexSearchResult` / `GroundedChunk`
  interfaces exactly — handler.ts stays untouched.
- Enforce `confidenceThreshold` (default 0.7) and
  `sourceAllowlist: ["*.go.jp"]` before returning chunks.
- Terraform: create `visa_legal`, `visa_faq`, `visa_secondary` data
  stores with IAM scoped to `roles/discoveryengine.viewer`.

Sprint 3 (production hardening):

- Add egress controls: VPC connector + Cloud NAT static IP +
  application-layer URL allowlist (`safeFetch`) per v3 §23.2.
- Add retriever / writer separation per v2 §10 for content integrity
  (prevents the writer role from poisoning the retrieved index).
- Verify the output sanitizer (see previous section) runs between
  `vertexSearch` and the structured response.

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

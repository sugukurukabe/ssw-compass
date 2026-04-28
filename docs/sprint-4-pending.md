# Sprint 4 Pending Tasks

Sprint 4 goal: Connectors Directory submission-ready. Two phases
run mostly sequentially; Phase 2's user-facing polish depends on
Phase 1's Vertex-real-mode being live so smoke screenshots show
real retrieval rather than fixture content.

---

## Phase 1: Vertex AI Search content (with gyoseishoshi review)

Inherited from Sprint 3 Batch 4 per
[ADR-010 Path B](./adr/ADR-010-vertex-ingestion-failure-mode.md).
Engineering is unblocked; this phase is content work
gyoseishoshi-authored.

### 1. URL health check review

- **Input**: [data/url-health-report.2026-04-27.md](../data/url-health-report.2026-04-27.md)
  (baseline from Batch 4 Day 2: 28/40 ok, 12/40 failed, moj 6 /
  meti 3 / mhlw 1 / mlit 1 / maff 1).
- Session action: gyoseishoshi reviews the 12 failed URLs page by
  page. For each:
  - Identify the semantically-equivalent surviving page
    (moj.go.jp subtree restructuring cases), OR
  - Confirm the page was retired with no equivalent (mark
    "withdrawn" in the next health report).
- Run [scripts/ingest-sources.ts](../scripts/ingest-sources.ts)
  `--dry-run --mode=best-effort` and
  `pnpm -C scripts tsx ingest-sources.ts --dry-run` equivalents to
  confirm the 28 surviving URLs are still alive on Sprint-4 day-1
  (trend check vs the 2026-04-27 baseline).
- Emit `data/url-health-report.YYYY-MM-DD.md` for the Sprint-4
  day-1 state and commit.

### 2. Gyoseishoshi-supervised URL expansion to 50+

Target outcomes, not a fixed add-count:

- `visa_faq` data store: **≥ 10 entries** (currently effectively 0
  per Sprint 3 close — the single seed was dead).
- `visa_legal`: maintain 34 + dead-entry replacements to land at
  ≥ 34 live.
- `visa_secondary`: 5 → ≥ 10 (secondary / explanatory material for
  each 特定技能分野).
- Each 特定技能 14 分野: **≥ 2 seeds across the three data stores**.
  Current moj-heavy 40 % concentration is legally defensible but
  sector-thin.
- Total: **≥ 50 entries** (soft target; absolute count is less
  important than coverage balance).

### 3. Ingestion run

- Preconditions: Phase 1.1 and 1.2 complete,
  `data/source-index.jsonl` committed with reviewed URLs.
- Command: `pnpm run ingest -- --mode=best-effort` (full ingest,
  failures logged but not aborting).
- ADR-010 §3 retry policy applies: PERMANENT failures tolerated,
  TRANSIENT retry with 30 / 120 / 300 s backoff.
- Post-ingest verification:
  - `grep -c '"contentSha256":"__PLACEHOLDER__"' data/source-index.jsonl` = 0
  - Each data store reports > 0 documents via the
    asia-northeast1-discoveryengine.googleapis.com list endpoint.

### 4. Flip `SSW_VERTEX_MODE=real` on staging

- Edit [infra/terraform/envs/staging/main.tf](../infra/terraform/envs/staging/main.tf)
  `module "cloud_run"` `env_vars` block. Add
  `SSW_VERTEX_MODE = "real"` and the 5 `SSW_VERTEX_*` config vars
  per ADR-006.
- `terraform plan` → expect `0 to add, 1 to change, 0 to destroy`
  (Cloud Run env update only; image stays ignore_changes).
- `terraform apply`.
- Smoke verification runbook (from ADR-010 §4):
  - `curl $URL/health` 200
  - `tools/list` returns 5 tools unchanged
  - `tools/call search_visa` returns `structuredContent.results[]`
    with ≥ 1 URL drawn from the newly-ingested
    `data/source-index.jsonl` (not fixture URLs).
  - Cloud Logging 5-min ERROR = 0.
- Enable opt-in
  [apps/server/test/vertex.integration.test.ts](../apps/server/test/vertex.integration.test.ts)
  if not already present from Batch 4 Day 3 pre-work (not shipped
  in Sprint 3 per ADR-010 Path B).
- Commit chain: TF flip → apply → smoke artefact → integration
  test.

### 5. Phase 1 exit criteria (must all pass)

- `grep -c '"contentSha256":"__PLACEHOLDER__"' data/source-index.jsonl` = 0
- `wc -l data/source-index.jsonl` ≥ 50
- `visa_faq` data store ≥ 10 live documents
- Each 特定技能分野 ≥ 2 seeds
- Staging `SSW_VERTEX_MODE=real` smoke 4-stage green
- Cloud Logging 24 h ERROR rate < 0.1 %

---

## Phase 2: Connectors Directory submission packet

Depends on Phase 1 exit because screenshots / demo videos capture
real Vertex retrievals, not fixture content.

### 1. Logo finalize

- Commission the final monoline SVG (compass needle + torii,
  depth-blue `#0A2540`) per v3 §A.
- Drop at [assets/logo/ssw-logo.svg](../assets/logo/ssw-logo.svg)
  replacing the placeholder. Add dark-mode / monochrome variants
  if the final is not colour-independent.
- Exit: `grep -l 'placeholder' assets/logo/*.svg` returns no files.

### 2. Screenshots (6-host coverage)

Capture a screenshot per host showing a successful `tools/call
search_visa` or `classify_procedure` response with non-fixture
content:

1. Claude Desktop (mcp-remote)
2. Claude Web (Custom Connector)
3. VS Code GitHub Copilot
4. Goose
5. Postman MCP
6. MCPJam

Each screenshot must show: disclaimer footer, `ja/en/id` language
affordance (at least one non-Japanese capture), and at least one
`*.go.jp` source URL in the response.

### 3. Demo video × 3 languages

60-second demos in `ja` / `en` / `id`. Script shows the same
flow (e.g., "特定技能1号 建設分野の更新手続を教えて") with
appropriate language switch. Deliverables: mp4 + subtitle files
+ captions matching the selected host's accessibility conventions.

### 4. Privacy policy (trilingual)

Gyoseishoshi-reviewed `ja` / `en` / `id` privacy policy. Must
reflect v2 §11 compliance (read-only, anonymous, 24 h IP hashing,
no cross-border transfer, DLP reject for 要配慮個人情報, §73-2
illegal-employment probe handling).

Publish at `/privacy` endpoint on the Cloud Run service AND as a
markdown file in `docs/privacy/` for version tracking. Link from
the Server Card's `limitations[]` array.

### 5. License selection

Finalise repository license (currently `TBD` in README). Candidates:

- Apache-2.0 (permissive, common for MCP ecosystem).
- MIT (simpler, also permissive).
- No open license + proprietary (closed-source).

Decision gated on Sprint 4 business review. ADR should capture the
reasoning. Update [README.md](../README.md), `package.json`, and
all workspace package.json files to match.

### 6. Anthropic Connectors Directory submission

- Follow the official submission checklist.
- Artefacts from §1–§5 above.
- Server-card polish: name / version / tagline / capabilities /
  limitations / termsOfService / privacyPolicy URLs must be
  finalised.
- Submit from the `a_kabe@sugu-kuru.co.jp` Anthropic account once
  the business-side packet is ready.

### 7. OpenAI Apps SDK submission (parallel)

If timing permits. Requires the same base assets.

### 8. Sprint 4 exit

- Both submissions in-review state (or submitted) with a
  same-week cadence between Anthropic and OpenAI if both paths
  taken.
- `docs/sprint-4-pending.md` → deleted or shrunk to empty.
- `docs/sprint-5-pending.md` created with post-submission items
  (re-scrape cron, Slack integration, multi-tenant preparation).

---

## How this doc is used

- At every Sprint 4 batch kickoff, re-read the relevant phase /
  section, confirm its prerequisites, and scope the batch.
- After each resolution, delete the section from this file so the
  document shrinks to zero by Sprint 4 close.
- If a new pending concern emerges during Sprint 4 execution,
  append it here with the same structure
  (discovery command → expected result → resolution plan).
- Do NOT silently skip items. Blocker encountered → capture the
  blocker and hand off to the next phase / sprint explicitly.

# Sprint 2 Summary — Visa Compass Japan

**Sprint**: 2 (2 weeks following Sprint 1)
**Completed**: 2026-04-27
**Status**: All 6 batches delivered; 2 new ADRs accepted; source-index seed
shipped (40 entries, Sprint 3 expands to 50+); logo placeholder tracked for
Sprint 3 / 4 replacement. `main` branch holds 5 unpushed Sprint 2 commits
plus 1 Sprint 2 closure commit (this document).

## What shipped

### Batch 1 — Cursor rules + ext-apps evaluation
- `docs/adr/ADR-005-ext-apps-1-7-0-evaluation.md` — Status: Accepted,
  decision: stay on `^1.6.0` pin.
- `.cursor/rules/tools.mdc` — five H2-structured sections: Registration,
  Handler pipeline, Input schema, Description format (Anthropic Directory +
  OpenAI Apps SDK "Use this when…" + mandatory PII rejection clause),
  Test prompts (Direct / Indirect / Negative per new tool).
- `apps/server/src/tools/search-visa/index.ts` — description extended with
  the PII rejection clause.

### Batch 2 — `classify_procedure` tool + `vcj-classify` UI Resource
- 5-rule decision tree + 3-language rationale + next-steps.
- UI with single-card result + 2-tier disclaimer.
- 8 decision-tree cases + 9 prompt cases.

### Batch 3 — `get_deadline_timeline` tool + `vcj-timeline` UI Resource
- 5 deadline kinds (notification_14days / annual_report / renewal_earliest
  / tokutei_ginou_1_cap / bridge_preparation), cross-year-safe month
  arithmetic.
- Renamed from `show_deadline_timeline` to `get_deadline_timeline` per
  Anthropic first-party naming conventions.
- Vertical timeline UI with per-row trust badge (colour added in Batch 5).
- 6 deadline-calc cases + 9 prompt cases.

### Batch 4 — Vertex AI Search real-connection dispatch
- `VCJ_VERTEX_MODE` env flag dispatches between fixture and real
  `@google-cloud/discoveryengine.SearchServiceClient`.
- Five real-mode env vars required; missing-env failure is loud and
  immediate (no silent fallback — auditability).
- `__setSearchClientForTesting` testing seam; 6 new vitest cases.
- `docs/adr/ADR-006-vertex-fixture-real-dispatch.md` — Status: Accepted.

### Batch 5 — `list_visa_documents` + `vcj-checklist` Commit Moment + trust-badge dark mode + internal tool visibility
- `list_visa_documents` tool — per-(visaCategory, industry) document
  catalog; SSW-1 + agriculture returns 8 entries, other combinations the
  3–5 item baseline.
- `vcj-checklist` UI — checkbox + notes + "この内容でAIに次の質問をする"
  button; `app.updateModelContext` fires **only** on explicit press
  (v3 §21.2 Commit Moment). UI-side PII regex rejects the notes before
  commit fires.
- `trust-badge` — 3 variants (`primary` / `secondary` / `community`)
  with WCAG 1.4.1 icon prefix (`✓` / `△` / `○`) so colour is never the
  sole differentiator. `@media (prefers-color-scheme: dark)` pulls from
  host CSS variables.
- Internal tool `_vcj_checklist_schema` with
  `_meta.ui.visibility: ["app"]` + `[INTERNAL]` description prefix
  (v3 §23.3).
- 6 catalog cases + 9 prompt cases.

### Batch 6 — source-index seed + logo placeholder + closure (this doc)
- `data/source-index.jsonl` — 40 seed URL entries across 7 ministries
  (moj / maff / mhlw / mlit / meti / soumu / cao), all `*.go.jp`. Schema
  includes `id`, `title`, `url`, `ministry`, `datastore`, `trustLevel`,
  `tags`, `lang`, `verifiedAt`, `contentSha256: "__PLACEHOLDER__"`.
- `assets/logo/vcj-logo.svg` — placeholder (depth-blue ring + "VCJ"
  wordmark). `aria-label` contains `"placeholder"` token so CI / review
  can grep and block accidental submission.
- `assets/logo/README.md` — v3 §A brand requirements + replacement
  procedure.
- `docs/sprint-3-pending.md` — two new sections (source-index 50+
  expansion; logo finalize).

## Numbers

| Metric | Sprint 1 close | Sprint 2 close |
|---|---|---|
| MCP tools (all) | 1 (`search_visa`) | **5** (4 public + 1 internal with `visibility:["app"]`) |
| MCP tools (LLM-visible) | 1 | 4 (`search_visa`, `classify_procedure`, `get_deadline_timeline`, `list_visa_documents`) |
| MCP resources | 1 (`vcj-search`) | **4** (+ `vcj-classify`, `vcj-timeline`, `vcj-checklist`) |
| UI workspaces (`ui/*`) | 1 | 4 |
| Shared-types zod schemas | 1 | **4** (+ classify-procedure, get-deadline-timeline, list-visa-documents) |
| vitest cases | 7 | **60** (+ 8 decision-tree, 9 classify prompts, 6 deadline-calc, 9 deadline prompts, 6 vertex, 6 catalog, 9 document prompts) |
| ADRs | 4 (001–004) | **6** (+ ADR-005 ext-apps stay-on-1.6, ADR-006 vertex dispatch) |
| Accepted `@ts-expect-error` | 1 (SDK Transport bug) | 1 (unchanged; SDK still 1.29.0) |
| UI bundle sizes (largest) | 299,405 B (`vcj-search`) | 305,839 B (`vcj-checklist`) — all 4 UIs well under 512 KB |
| `*.go.jp` seed URL catalog | 0 | **40** (Sprint 3 expands to 50+) |

## ADRs accepted this sprint

- **ADR-005** — `@modelcontextprotocol/ext-apps` stay on `^1.6.0`;
  1.6.0 → 1.7.0 is non-breaking, hoisted installer already resolves to
  1.7.0, narrowing the pin is cosmetic and out of Sprint 2 scope.
- **ADR-006** — Vertex AI Search fixture / real dispatch via
  `VCJ_VERTEX_MODE` env flag; five real-mode env vars mandatory; silent
  fallback rejected for auditability.

## Unresolved / deferred (tracked in sprint-3-pending.md)

- `@ts-expect-error` at `apps/server/src/index.ts:62` — SDK Transport
  interface type mismatch (upstream PR #1766 / PR #1821 pending). Remove
  on SDK 1.30+.
- `TODO(sprint-3)` in every UI Resource `mcp-app.html` — CSP
  `'unsafe-inline'` → sha256 hash + `strict-dynamic` + Trusted Types.
- Output sanitizer (`SANITIZATION_ACTIVE = false`) — pattern set is
  complete; flip + snapshot test in Sprint 3.
- Cloud DLP second stage — add to `scrubInputForPII` behind `DLP_ENABLED`
  flag.
- Real Vertex AI Search data store provisioning (Terraform) + VPC egress
  (v3 §23.2) + confidence tuning (replace 0.9 placeholder).
- `source-index.jsonl` expansion from 40 → 50+ + real SHA-256 population.
- VCJ logo finalize (human-designed monoline 羅針盤 + 鳥居).
- Document catalog (`document-catalog.ts`): gyoseishoshi-reviewed per-
  industry wording.
- `RATIONALE_BY_LANG` / `NEXT_STEPS_BY_LANG` in `decision-tree.ts`:
  gyoseishoshi-reviewed replacement.
- `DEADLINE_FACTS` in `deadline-calc.ts`: gyoseishoshi-reviewed wording;
  secondary / community trustLevel assignments once the source graph is
  diverse enough.
- Host-side honouring of `_meta.ui.visibility: ["app"]` is implementation-
  dependent; until hosts comply, the `[INTERNAL]` description prefix is
  the sole LLM-visible signal for the `_vcj_checklist_schema` helper.

## Handover to Sprint 3

Sprint 3 owns the production-hardening pass:

1. Terraform: 3 data stores (`visa_legal` / `visa_faq` / `visa_secondary`),
   BYOSA + Workload Identity Federation, Cloud Run deploy with Secret
   Manager-mounted env vars (v2 §8.4).
2. Ingest pipeline: read `data/source-index.jsonl`, fetch content, compute
   SHA-256, push to Discovery Engine with confidence scoring enabled.
   Replace the `contentSha256: "__PLACEHOLDER__"` entries in-place.
3. Surround the real Vertex branch with v3 §23.2 egress controls
   (VPC connector + Cloud NAT + `safeFetch` allowlist).
4. Flip `SANITIZATION_ACTIVE` to `true` and add the paired snapshot test
   (security.mdc rule).
5. Layer Cloud DLP second stage in `pii/index.ts`.
6. CSP hash migration in every `mcp-app.html` (post-build script +
   Report-Only rollout).
7. Expand `source-index.jsonl` to 50+ and replace Sprint 2 `__PLACEHOLDER__`
   hashes with real values.
8. 6-host verification (Claude web/Desktop, VS Code Copilot, Goose,
   Postman, MCPJam).

## Pointers

- `docs/adr/` — all six ADRs.
- `docs/sprint-3-pending.md` — grep-indexed checklist of every debt item
  deferred to Sprint 3, with the exact `grep` command, the Sprint 2-close
  hit count, and the resolution plan per section.
- `data/source-index.jsonl` — 40-entry seed, Sprint 3 pipeline input.
- `assets/logo/` — placeholder + replacement procedure.

---

Sprint 2 done. Zero regressions against Sprint 1. `main` holds 6 Sprint 2
commits (Batch 1–6) ready for push alongside this summary.

# ADR-007: Brand renaming from "Visa Compass Japan" to "SSW Compass"

- **Status**: Accepted
- **Date**: 2026-04-27 (pre-Sprint 3 cleanup)
- **Deciders**: @kabe, SSW Compass core team
- **Supersedes**: `docs/specs/v3-supplement.md` §A brand map (VCJ → SSW at
  the identifier level; the Compass metaphor itself is preserved).

## Context

Sprint 1–2 shipped under the brand "Visa Compass Japan" / "VCJ". During
the Sprint 2 close review the name was found to misrepresent the
product's actual scope:

- **Actual scope** — Japanese Specified Skilled Worker (特定技能, SSW)
  visa procedures only. Agriculture, nursing care, manufacturing, etc.
  five-year cumulative cap, bridge-to-SSW from Technical Intern Training,
  MAFF / MHLW / MLIT / METI sector-ministry flows. Zero coverage of
  business-manager, spouse, dependent, permanent-resident, humanitarian
  status procedures.
- **"Visa Compass Japan" reading** — "visa" is read by both Japanese and
  English audiences as "any visa", inviting questions the app is not
  equipped to answer and creating a scope-misrepresentation risk before
  Sprint 4 Connectors Directory submission.

Renaming windows are narrow. Sprint 4 submission (Anthropic Connectors
Directory + OpenAI Apps SDK) makes the name externally distributed and
difficult to change afterwards. All current Cursor sessions / git history
are the last moment to rename without breaking end-user assumptions.

A narrower brand also:

- Reduces the 行政書士法 §19-1 defensive surface — the app's scope is
  now self-disclosed in the name itself, which strengthens the legal
  positioning already encoded in `DISCLAIMER_BY_LANG`.
- Gives the tool-choice signal to LLMs a clearer prior: "SSW Compass"
  hints at specified-skilled-worker-only much more strongly than "Visa
  Compass Japan".
- Unblocks cleaner GCP project / domain provisioning in Sprint 3
  (`ssw-compass-prod` / `ssw-compass.jp` rather than continuing
  `vcj-public-*`).

## Decision

1. Rename the product brand:
   - English formal: **"SSW Compass"**
   - English tagline: *"The compass for Japan's Specified Skilled Worker visa procedures"*
   - Japanese formal: 「SSW コンパス」 (preferred) / 「特定技能コンパス」 (alternative)
   - Japanese tagline: 「特定技能ビザ手続きの羅針盤」

2. Rename the technical namespace:
   - Package scope: `@vcj/*` → `@ssw/*`
   - UI Resource URI prefix: `ui://vcj-*` → `ui://ssw-*`
   - Workspace directory prefix: `ui/vcj-*` → `ui/ssw-*`
   - GCP resources: `vcj-mcp` → `ssw-mcp`, `vcj-runtime` → `ssw-runtime`,
     `vcj-egress` → `ssw-egress`, `vcj-deploy` → `ssw-deploy`,
     `vcj-public-prod` → `ssw-compass-prod`, etc.
   - OTel service name: `vcj-mcp` → `ssw-mcp`
   - Internal helper tool: `_vcj_checklist_schema` → `_ssw_checklist_schema`

3. **Preserve** the MCP tool identifiers — `search_visa`,
   `classify_procedure`, `get_deadline_timeline`, `list_visa_documents`
   stay as-is. These identifiers are the stable contract at the MCP
   layer and will be part of the Sprint 4 Connectors Directory submission
   history; changing them would fracture tooling ecosystems that pin by
   tool name (MCP Inspector test runs, directory reviewer playbooks,
   etc.). Brand naming and tool naming are treated as separate layers.

4. **Preserve** the Compass metaphor — v3 §A metaphor (navigation tool
   that points the way but does not take you to the destination) remains
   the brand's anchor. The §19-1 defense reading of the metaphor is
   unchanged.

5. **Preserve** `DISCLAIMER_BY_LANG` (ja/en/id) content — brand strings
   inside disclaimer text were updated mechanically by the renaming
   pass, but no legal wording was altered.

## Consequences

### Positive

- Scope honesty: the product name now matches the capabilities.
- Sprint 3 GCP provisioning can start clean with `ssw-compass-prod`.
- Sprint 4 submission packets carry a shorter, sharper brand.
- Tool names (`search_visa`, etc.) did not change, so future Sprint 4
  submission history is continuous with the Sprint 1–2 dev history in
  spirit — just the surrounding brand layer is updated.
- UI bundle sizes are within a few bytes of the pre-rename baseline
  (VCJ/SSW are both 3 characters).

### Negative / follow-up

- All GitHub references, any external docs, and the repository URL
  (`github.com/sugukurukabe/vcj-public`) still carry the `vcj-public`
  slug. The repo itself is not renamed in this cleanup; the `origin`
  remote continues to work. Sprint 3 or Sprint 4 prep may rename to
  `ssw-compass` if it is worth the redirect cost.
- `vcj-public-prod` GCP project is designated for discard in Sprint 3;
  no resources were provisioned in that project during Sprint 1–2
  (Cloud Run deploy is a Sprint 3 deliverable), so no migration is
  required.
- `pnpm-lock.yaml` contains one incidental `VCJ` substring inside a
  sha512 integrity hash — unrelated to branding, left as-is.
- Documentation references to `VCJ` across `docs/specs/v2-*.md` and
  `docs/specs/v3-supplement.md` were mechanically renamed. A future
  maintenance pass may wish to revise the §A brand map in v3 to state
  the current naming directly rather than showing a VCJ→SSW diff.
- `package.json` workspace names became `@ssw/ui-ssw-*` (the scope and
  the package-local both carry "ssw"). Retained for consistency with
  the Sprint 1 naming style; a future cleanup could shorten to
  `@ssw/ui-*` if desired but has no functional impact.

## Renaming checklist (what was replaced)

| Pattern | Replacement | Scope |
|---|---|---|
| `Visa Compass Japan` | `SSW Compass` | copy / docs |
| `Visa Compass` (other) | `SSW Compass` | copy / docs |
| `ビザコンパス` | `SSW コンパス` | copy (ja) |
| `@vcj/` | `@ssw/` | package scope |
| `ui://vcj-` | `ui://ssw-` | MCP resource URI |
| `vcj-mcp` | `ssw-mcp` | OTel service / server.info / /health |
| `vcj-runtime` / `vcj-deploy` / `vcj-egress` / `vcj-public` | `ssw-*` | GCP identifiers in deployment-checklist |
| `_vcj_checklist_schema` | `_ssw_checklist_schema` | internal tool |
| `vcj-logo` | `ssw-logo` | assets/logo filename + references |
| `vcj-` / `vcj/` | `ssw-` / `ssw/` | kebab-case / path-prefix remainder |
| `vcj_` | `ssw_` | snake_case identifiers (Terraform, etc.) |
| `VCJ` | `SSW` | uppercase identifiers |

**Not replaced** (intentional):

- MCP tool names: `search_visa`, `classify_procedure`,
  `get_deadline_timeline`, `list_visa_documents`
- File names that mirror tool names: `search-visa.ts`,
  `classify-procedure/`, etc. (kept for 1-to-1 readability with the
  MCP tool identifiers)
- `DISCLAIMER_BY_LANG` legal text (only embedded brand strings were
  touched, disclaimer substance is unchanged)

## Verification performed

- `git ls-files | wc -l` = 117 files; 116 of them were passed through
  the sed pipeline (pnpm-lock was excluded and regenerated by
  `pnpm install`).
- `git grep -l "vcj\|VCJ"` outside pnpm-lock returns 0 files.
- `pnpm install` regenerated the lockfile with `@ssw/*` workspace
  references.
- `tsc --noEmit` — 0 errors across `@ssw/server`, `@ssw/shared-types`,
  `@ssw/ui-bridge`, and all four `@ssw/ui-ssw-*` packages.
- `biome check` — 0 errors across 58 source files.
- `vitest` — 60/60 passed (no test content was affected; only
  package scope and import paths).
- All four UI bundles rebuild under 512 KB budget, sizes within a few
  bytes of the VCJ-era baseline.
- MCP smoke:
  - `GET /health` → `service: "ssw-mcp"`
  - `GET /.well-known/mcp.json` → `name: "SSW Compass"`,
    limitations array unchanged (行政書士法 §19-1 clause preserved).
  - `initialize` → `serverInfo: { name: "ssw-mcp", version: "1.0.0" }`
  - `tools/list` → 5 tools (4 public + `_ssw_checklist_schema`
    with `visibility: ["app"]`), all with UI URIs at `ui://ssw-*`.
  - `resources/list` → 4 resources, all at `ui://ssw-*`.

## Related

- ADR-001..006 — earlier decisions, all updated mechanically with the
  new brand strings. Their Decision and Consequences sections are
  unchanged in substance.
- `docs/specs/v3-supplement.md` §A — original brand map. This ADR
  supersedes the VCJ half of that map.
- `docs/sprints/sprint-2-summary.md` — Sprint 2 results, updated with the
  SSW Compass name. The underlying metrics (6 ADRs, 60 vitest cases,
  4 UI workspaces, 40-entry source-index, etc.) are unchanged.

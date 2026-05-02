# Submission Readiness Audit

> **Date**: 2026-05-02
> **Scope**: Anthropic Connectors Directory + OpenAI Apps SDK readiness
> **Status**: Not ready for final submission until blockers are resolved

## Blockers

| ID | Blocker | Status | Owner |
|---|---|---|---|
| B1 | Privacy policy final check | Pending | Wall |
| B2 | Vertex real mode | Resolved — prod returns 5 real-source results | Engineering |
| B3 | 5 compliant screenshots for redesigned MCP Apps (PNG, width ≥1000, app response only) | Resolved — committed under `docs/screenshots/`, 1200px width | Engineering |
| B4 | 6-host verification (Claude Desktop + Web minimum) | Pending | Wall |
| B5 | Internal `_ssw_checklist_schema` visible in tools/list | Resolved — removed from public registration | Engineering |
| B6 | Demo video ≤120 seconds | Pending | Wall |

## Ready items

| Area | Status |
|---|---|
| HTTPS public endpoint | Pass |
| SSL certificate | ACTIVE |
| Health endpoint | Pass |
| Logo assets | Pass |
| Apache-2.0 license | Pass |
| SECURITY / CONTRIBUTING / CHANGELOG | Pass |
| Privacy endpoint | Pass — live 200 |
| ai-plugin endpoint | Pass — live 200 |
| OpenAPI endpoint | Pass — live 200 |
| Tool annotations | Pass — public tools/list is read-only and internal helper removed |
| MCP tools/resources/prompts | Pass — tools, UI resources, catalog resources, prompts verified by `smoke:mcp` |
| Vertex source import | Pass — `visa_legal_core_v2` 139 docs, `visa_forms_v2` 118 docs imported |
| Vertex real mode | Pass — prod search_visa returns source-index URLs |
| MCP Apps UX redesign | Pass — production deployed |
| Screenshots | Pass — 5 PNG files committed, `pnpm check:submission:strict` passes |

## Acceptance checklist before submission

- [x] `curl -fsS https://mcp.ssw-compass.jp/privacy` returns complete non-placeholder policy
- [x] `curl -fsS https://mcp.ssw-compass.jp/.well-known/ai-plugin.json` returns 200 JSON
- [x] `curl -fsS https://mcp.ssw-compass.jp/.well-known/openapi.json` returns 200 JSON
- [x] `/.well-known/mcp.json` includes license/privacy/terms URLs live
- [x] `data/source-index.jsonl` has zero `__PLACEHOLDER__` values
- [x] Vertex real mode returns source URLs from ingested content
- [x] MCP `tools/list`, `resources/list`, `prompts/list`, and catalog resources pass smoke
- [x] 5 redesigned MCP Apps screenshots committed under `docs/screenshots/`
- [x] `pnpm check:submission:strict` passes
- [ ] Privacy policy has no placeholders and is final-checked
- [x] Tool inventory reviewed; public tools are read-only informational tools
- [ ] Claude Desktop + Claude Web verification pass

## Recommendation

Do not submit to Anthropic/OpenAI until remaining human-side blockers are resolved. The product is production-deployed, submission endpoints are live, MCP tools/resources/prompts smoke passes, Vertex real grounding is working, and screenshots are committed. Remaining blockers: final privacy check, demo video, and host verification.

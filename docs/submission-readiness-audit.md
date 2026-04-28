# Submission Readiness Audit

> **Date**: 2026-04-29
> **Scope**: Anthropic Connectors Directory + OpenAI Apps SDK readiness
> **Status**: Not ready for final submission until blockers are resolved

## Blockers

| ID | Blocker | Status | Owner |
|---|---|---|---|
| B1 | Privacy policy final gyoseishoshi review | Pending | Wall + gyoseishoshi |
| B2 | Vertex real mode (fixture currently) | Pending | Engineering + gyoseishoshi URL cleanup |
| B3 | 3-5 compliant screenshots (PNG, width ≥1000, app response only) | Pending | Wall |
| B4 | 6-host verification (Claude Desktop + Web minimum) | Pending | Wall |
| B5 | Internal `_ssw_checklist_schema` visible in tools/list | Resolved — removed from public registration | Engineering |

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
| Tool annotations | Pass — internal helper removed from public tools/list |

## Acceptance checklist before submission

- [x] `curl -fsS https://mcp.ssw-compass.jp/privacy` returns complete non-placeholder policy
- [x] `curl -fsS https://mcp.ssw-compass.jp/.well-known/ai-plugin.json` returns 200 JSON
- [x] `curl -fsS https://mcp.ssw-compass.jp/.well-known/openapi.json` returns 200 JSON
- [x] `/.well-known/mcp.json` includes license/privacy/terms URLs live
- [x] `data/source-index.jsonl` has zero `__PLACEHOLDER__` values
- [ ] Vertex real mode returns source URLs from ingested content
- [ ] 3-5 screenshots committed under `assets/screenshots/`
- [ ] Privacy policy has no placeholders and is reviewed
- [x] Tool inventory reviewed; Pro-only/write-like tools clearly classified
- [ ] Claude Desktop + Claude Web verification pass

## Recommendation

Do not submit to Anthropic/OpenAI until remaining blockers are resolved. The product is production-deployed and submission endpoints are live, but directory submission still requires final privacy review, real grounding, screenshots, and two-host verification.

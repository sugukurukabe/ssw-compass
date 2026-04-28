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
| B5 | Internal `_ssw_checklist_schema` visible in tools/list | Needs decision | Engineering |

## Ready items

| Area | Status |
|---|---|
| HTTPS public endpoint | Pass |
| SSL certificate | ACTIVE |
| Health endpoint | Pass |
| Logo assets | Pass |
| Apache-2.0 license | Pass |
| SECURITY / CONTRIBUTING / CHANGELOG | Pass |
| Privacy endpoint | Implemented, pending final deploy verification |
| ai-plugin endpoint | Implemented, pending final deploy verification |
| OpenAPI endpoint | Implemented, pending final deploy verification |
| Tool annotations | Mostly pass; internal tool visibility decision remains |

## Acceptance checklist before submission

- [ ] `curl -fsS https://mcp.ssw-compass.jp/privacy` returns complete non-placeholder policy
- [ ] `curl -fsS https://mcp.ssw-compass.jp/.well-known/ai-plugin.json` returns 200 JSON
- [ ] `curl -fsS https://mcp.ssw-compass.jp/.well-known/openapi.json` returns 200 JSON
- [ ] `/.well-known/mcp.json` includes license/privacy/terms URLs live
- [ ] `data/source-index.jsonl` has zero `__PLACEHOLDER__` values
- [ ] Vertex real mode returns source URLs from ingested content
- [ ] 3-5 screenshots committed under `assets/screenshots/`
- [ ] Privacy policy has no placeholders and is reviewed
- [ ] Tool inventory reviewed; Pro-only/write-like tools clearly classified
- [ ] Claude Desktop + Claude Web verification pass

## Recommendation

Do not submit to Anthropic/OpenAI until B1-B5 are resolved. The product is production-deployed, but directory submission requires stronger evidence: final privacy policy, real grounding, screenshots, and tool visibility cleanup.

# MCP 2026-07-28 RC Conformance Report

Date: 2026-06-12 (updated after local end-to-end smoke)

## Scope

Target: SSW Compass MCP server (`apps/server`) with compatibility for
`2025-11-25` and RC behavior for `2026-07-28`.

The official MCP 2026-07-28 conformance suite is not bundled in this repository
yet. Until the official suite is available, this report records the local checks
derived from the RC MUST items in the upgrade plan.

## Local Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Stateless Streamable HTTP | Pass | `sessionIdGenerator: undefined`; no `Mcp-Session-Id` issuance |
| `server/discover` | Pass | `test/mcp-rc-transport.test.ts` |
| `Mcp-Method` mismatch -> 400 | Pass | `test/mcp-rc-transport.test.ts` |
| `Mcp-Name` mismatch -> 400 | Pass | `test/mcp-rc-transport.test.ts` |
| `requestState` opaque token | Pass | `approval_requests.id` (`ars_` + base64url 128-bit) |
| Replay CAS failure | Pass | `test/approval/repository.test.ts` |
| TOCTOU draft hash mismatch | Pass | `test/approval/mrtr.test.ts` |
| Edit loop escalation | Pass | `test/approval/mrtr.test.ts` |
| Cache metadata | Pass | `test/cache.test.ts`, `test/tools/list-law-updates/handler.test.ts` |
| 10-language error dictionary | Pass | `test/i18n/error-dictionary.test.ts` |
| OAuth scope step-up | Pass | `test/auth/scopes.test.ts` |
| Server card | Pass | `/.well-known/mcp-server-card.json` uses `buildServerCard()` |
| Local end-to-end smoke (HTTP) | Pass | `MCP_URL=http://localhost:8085/mcp node scripts/smoke-mcp.mjs` — 8 tools, 10 UI resources (new + legacy URIs), catalogs, prompts all PASS |
| Live `tools/call` with outputSchema validation | Pass | search_visa / classify_procedure / get_deadline_timeline / list_visa_documents / list_law_updates / validate_zairyu_compatibility all return validated `structuredContent` with cache `_meta` |
| Anonymous scope rejection | Pass | `tools/call submit_gyoseishoshi_approval` without token → HTTP 403 + `WWW-Authenticate: Bearer error="insufficient_scope", scope="compass:approve"` |

## Verification Commands

```sh
pnpm -F @ssw/shared-types build
pnpm -F @ssw/ui-bridge build
pnpm -F @ssw/server test
pnpm -F @ssw/server typecheck
pnpm -F @ssw/server lint
pnpm -r --filter './ui/**' typecheck
```

## Fixes Found in Final Production Review

The SDK (`@modelcontextprotocol/sdk` 1.29 `validateToolOutput`) validates
`structuredContent` against `outputSchema` on every successful call. The final
review caught and fixed three would-be production failures before release:

1. `list_law_updates` returned `datasetReviewedDate` not present in the strict
   output schema → schema extended (append-only).
2. `search_visa` empty-result path returned no `structuredContent` → now returns
   a validated empty `results` payload.
3. `list_visa_documents` empty-result path had the same gap → now returns a
   validated empty `documents` payload.

## Staging Verification (2026-06-13)

CD staging (run 27439762161) green after merging PR #99 / #100:

- 8 tools served; UI resources (semver + legacy) resolve.
- HITL guard smoke: anonymous `submit_gyoseishoshi_approval` is blocked.
  staging (`SSW_AUTH_MODE=anonymous`) blocks via the HITL gate (HTTP 200 +
  `result.isError=true`); prod (`SSW_AUTH_MODE=jwt`) blocks via the scope gate
  (HTTP 403 + `-32003`). Both satisfy the "anonymous cannot drive an approval"
  contract.
- Supabase migrations 001–005 applied to the dedicated prod project; CAS replay
  and `decision` column verified.

## Governance Alignment

- ADR-024 approves the two L2 HITL write tools. `.cursor/rules/00-global-context.mdc`
  constraint #3 updated to permit them under scope + HITL + audit guards
  (see `docs/proposals/read-only-rule-update-for-hitl.md`, status: Applied).

## MCP Primitive Activation (2026-06-13, ADR-026)

| Primitive | Status |
| --- | --- |
| Tools / Prompts / Resources / Resource Templates | Activated |
| Completion | Activated on Resource Template args **and** prompt args (`completable()`) |
| Logging | Intentionally not activated (stateless transport; WORM audit is the log of record) |
| Pagination | Not applicable (bounded catalogs; SDK auto-paginates if a page overflows) |

Sampling is intentionally never used (conflicts with the primary-source-only,
no-LLM-fallback principle). See ADR-026 for the full decision record.

## External SDK Assessment (2026-06-13, ADR-025)

`@modelcontextprotocol/sdk` 1.29.0 (latest published) capability check:

| RC feature | SDK 1.29.0 | Status |
| --- | --- | --- |
| `server/discover` RPC | Not in transport/protocol | Adapter still required |
| `Mcp-Method` / `Mcp-Name` routing headers | Not implemented | Adapter still required |
| Elicitation (`inputRequired`) | Stable types present | Custom MRTR retained |
| Tasks extension | `experimental/tasks/*`, marked "may change without notice" | Not adopted (too unstable for a live approval flow) |

Decision (ADR-025): keep the thin Express adapter and custom MRTR until a stable
SDK release covers `server/discover` + routing headers and the Tasks/elicitation
API graduates out of `experimental`. The adapter is isolated and covered by
`test/mcp-rc-transport.test.ts`.

## Residual Risk

- The RC may change before the final 2026-07-28 publication.
- Adapter removal is gated on the ADR-025 migration triggers (stable SDK support).
- Cloud Tasks behavior requires deployed verification when async is enabled;
  GCS lifecycle + `prepare_document_package` / `get_package_status` signed-URL
  flow verified end-to-end on prod (2026-06-13).

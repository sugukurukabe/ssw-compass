# MCP 2026-07-28 RC Conformance Report

Date: 2026-06-12

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

## Verification Commands

```sh
pnpm -F @ssw/shared-types build
pnpm -F @ssw/ui-bridge build
pnpm -F @ssw/server test
pnpm -F @ssw/server typecheck
pnpm -F @ssw/server lint
pnpm -r --filter './ui/**' typecheck
```

## Residual Risk

- The RC may change before the final 2026-07-28 publication.
- The thin Express adapter should be removed once `@modelcontextprotocol/sdk`
  ships first-class support for `server/discover`, routing headers, and MRTR.
- Cloud Tasks and GCS lifecycle behavior require deployed GCP verification.

# ADR-025: MCP SDK RC features — keep the thin Express adapter until stable

- **Status**: Accepted
- **Date**: 2026-06-13
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `apps/server/src/index.ts` (RC transport adapter), `apps/server/src/approval/mrtr.ts`

---

## Context

SSW Compass v2.1/v2.2 ships MCP 2026-07-28 RC behavior ahead of the official
publication date (2026-07-28). The RC-specific behavior is currently implemented
as a thin Express layer in `apps/server/src/index.ts`:

- `server/discover` RPC handling (`handleServerDiscover`)
- `Mcp-Method` / `Mcp-Name` routing-header validation (`validateMcpRoutingHeaders`)
- HITL Multi Round-Trip (`buildApprovalInputRequiredResult` / `applyApprovalInputResponse`)

The original intent (conformance-report.md, Residual Risk) was to remove this
adapter once `@modelcontextprotocol/sdk` ships first-class support.

This ADR records the capability assessment of the SDK as of 2026-06-13 and the
decision on whether to migrate now.

## Assessment (SDK `@modelcontextprotocol/sdk` 1.29.0 — latest published)

| RC feature | SDK 1.29.0 | Decision |
| --- | --- | --- |
| `server/discover` RPC | Not implemented in transport/protocol (only OAuth metadata discovery in `shared/auth`) | Keep adapter |
| `Mcp-Method` / `Mcp-Name` routing headers | Not implemented (no references) | Keep adapter |
| Elicitation (`inputRequired`) | Present in **stable** types | Keep custom MRTR for now (works; avoids churn) |
| Tasks extension | Present under `@modelcontextprotocol/sdk/experimental` (`experimental/tasks/*`) and **explicitly marked "experimental and may change without notice"** | Do NOT adopt yet |

Key facts:

- `1.29.0` is the latest npm-published version; there is no newer release that
  adds native `server/discover` or routing-header support.
- The Tasks / interactive-request machinery exists only behind the
  `experimental` entry point with an explicit instability warning.
- The approval/MRTR flow is **live in production** (Supabase-backed, ADR-024).

## Decision

Keep the thin Express adapter and the custom MRTR helpers for now. Do **not**
migrate the production approval flow onto the experimental Tasks API, and do not
remove the `server/discover` / routing-header shims.

Rationale:

1. The two transport-level RC features (`server/discover`, routing headers) have
   **no** stable SDK equivalent, so the adapter is still required.
2. Migrating a live, audited approval system onto an API that is explicitly
   "experimental and may change without notice" is unjustified risk before the
   RC is even finalized.
3. The adapter is small, isolated, and fully covered by
   `test/mcp-rc-transport.test.ts`.

## Migration triggers (revisit this ADR when ALL hold)

- A **stable** (non-experimental) `@modelcontextprotocol/sdk` release handles
  `server/discover` and `Mcp-Method`/`Mcp-Name` routing in the
  Streamable HTTP transport.
- The Tasks / elicitation interactive-request API graduates out of
  `experimental` with a stable import path.
- The official MCP 2026-07-28 specification is published (so the RC shape is
  frozen).

At that point: delete `handleServerDiscover` / `validateMcpRoutingHeaders` from
`index.ts`, port `buildApprovalInputRequiredResult` / `applyApprovalInputResponse`
onto the stable Tasks API, and keep `test/mcp-rc-transport.test.ts` green against
the SDK-native behavior.

## Consequences

- No code change in this ADR; the adapter remains the source of RC behavior.
- The SDK dependency stays pinned at `^1.29.0`; bumping it requires re-running
  this assessment.
- conformance-report.md Residual Risk is updated to reference this ADR.

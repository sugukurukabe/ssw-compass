# ADR-002: Errata for v2 §6.1 (UI Resource sample) — adopt ext-apps@1.7.0 real API

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 1, Batch 4)
- **Deciders**: @kabe, SSW core team
- **Supersedes**: partially overrides `docs/specs/v2-comprehensive-design.md` §6.1 sample code

## Context

`docs/specs/v2-comprehensive-design.md` §6.1 contains a hand-written sample
of `ui/ssw-search/src/main.tsx` showing how the UI Resource should connect
to the host via `@modelcontextprotocol/ext-apps`. During Batch 4 we
cross-checked the sample against the actual package at
`@modelcontextprotocol/ext-apps@^1.6.0` (resolved to **1.7.0** on npm as of
2026-04-27) and found **three API mismatches** between spec and runtime.

| # | v2 §6.1 sample | Reality in `ext-apps@1.7.0` | Source of truth |
|---|---|---|---|
| a | `await app.connect(new PostMessageTransport())` — no-args | `class PostMessageTransport` constructor requires `(eventTarget, eventSource)`; a View passes `(window.parent, window.parent)` | `node_modules/@modelcontextprotocol/ext-apps/dist/src/message-transport.d.ts` |
| b | `app.onteardown = async () => ({})` | `App` class exposes no `onteardown` setter; teardown requests are handled by the SDK's default behavior, or via `setRequestHandler(ResourceTeardownRequestSchema, ...)` | `node_modules/@modelcontextprotocol/ext-apps/dist/src/app.d.ts` |
| c | `app.ontoolresult = (result) => render(result.structuredContent)` — assumes `params.result.structuredContent` | `McpUiToolResultNotification["params"]` **is** `CallToolResult`; access `params.structuredContent` directly, there is no `params.result` wrapper | `node_modules/@modelcontextprotocol/ext-apps/dist/src/spec.types.d.ts` line 185 |

Each mismatch was verified by reading the packaged `.d.ts` files in
`node_modules/` and confirmed with `tsc --noEmit` (the `params.result`
form produces TS2339 "Property 'result' does not exist on type '{}'"; the
`new PostMessageTransport()` form fails `TS2554` on the missing arguments).

## Decision

Implement `ui/ssw-search/src/main.tsx` against the actual published API:

```typescript
// (a) Two-argument PostMessageTransport for View role
await app.connect(new PostMessageTransport(window.parent, window.parent));

// (b) No onteardown handler — rely on SDK default behavior for
//     ui/resource-teardown; revisit if SSW needs custom teardown logic
//     (see setRequestHandler below for the escape hatch)

// (c) params IS the CallToolResult
app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) return;
  render(structured as SearchVisaOutput, currentLang, root);
};
```

This implementation is the source of truth; the v2 §6.1 sample is
considered errata until revised.

## Consequences

Positive:

- `pnpm -F @ssw/ui-ssw-search typecheck` passes under
  `exactOptionalPropertyTypes: true` with **no `@ts-expect-error` in UI
  code**.
- UI correctly receives and renders `structuredContent` from
  `tools/call search_visa` in integration tests against the real MCP
  flow (`initialize → tools/list → tools/call`).
- The UI survives minor upgrades of `ext-apps` (1.6 → 1.7) with no code
  changes because these shapes are stable since at least 1.6.

Negative / follow-up:

- Future SSW UIs in Sprint 2 (`ssw-checklist`, `ssw-deadline-timeline`)
  must reference this ADR, not v2 §6.1, for the connect/teardown/
  handler patterns.
- If SSW needs a custom teardown hook (e.g. to persist UI draft state
  before the iframe unmounts), use
  `app.setRequestHandler(ResourceTeardownRequestSchema, async () => ({}))`
  from the base Protocol class; this is the SDK-blessed path since
  `onteardown` does not exist.
- v2 §6.1 should be corrected in a future revision. Until then, this ADR
  plus the Batch 4 commit (`b59e4e6`) are the canonical reference.

## Related

- `ADR-001` — pino v10 upgrade (parallel spec errata)
- `docs/specs/v2-comprehensive-design.md` §6.1 (sample being superseded)
- `docs/specs/v3-supplement.md` §20 (skeleton UX — unaffected; the
  skeleton rendering and `ontoolinput` shape are correct as specified)

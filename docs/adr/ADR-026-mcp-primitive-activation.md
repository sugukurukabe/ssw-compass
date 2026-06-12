# ADR-026: MCP primitive activation scope

- **Status**: Accepted
- **Date**: 2026-06-13
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `apps/server/src/{server.ts,resources/,prompts/,tools/}`

---

## Context

The `mcp-reference-build` standard evaluates a server on full activation of the
seven MCP primitives: **Tools, Prompts, Resources, Resource Templates,
Completion, Logging, Pagination**. This ADR records SSW Compass's activation
status and the deliberate decisions for the primitives that are not activated.

## Activation status (2026-06-13)

| Primitive | Status | Evidence / Decision |
| --- | --- | --- |
| Tools | ✅ Activated | 9 tools, full annotations (`readOnly/destructive/idempotent/openWorld`), `outputSchema`, icons |
| Prompts | ✅ Activated | 3 workflow prompts with `argsSchema` |
| Resources | ✅ Activated | `catalog/manifest`, `source-index`, `forms-catalog`, `industry-resource-candidates` |
| Resource Templates | ✅ Activated | `forms/{industry}`, `sources/{industry}`, `notifications/{eventContext}` |
| Completion | ✅ Activated | Resource Template args (`complete.industry`) **and** prompt args (`completable()` on current_status / target_status / industry / event / visa_category). SDK auto-advertises the `completions` capability (`mcp.js` setCompletionRequestHandler). |
| Logging | ⛔ Intentionally not activated | See Decision below |
| Pagination | ⛔ Not applicable | See Decision below |

Modern (post-7) features: `outputSchema`/`structuredContent`, icons, Server Card
(`/.well-known/mcp.json` + `/.well-known/mcp-server-card.json`) are activated.
Elicitation/Tasks are handled via the RC adapter (ADR-025). **Sampling is
intentionally never used** — it would contradict the "primary-source only, no
LLM-knowledge fallback" principle (00-global-context.mdc constraint 4).

## Decision

### Completion — activate on both Resource Templates and prompt args (done)

Prompt arguments are deliberately free-text natural-language Japanese (the
primary entry point for non-technical staff). We attach curated Japanese
prefix-filtered candidate lists via `completable()` so the IDE/host shows useful
suggestions without forcing an enum. The SDK auto-registers the `completions`
capability when any completable schema or resource-template `complete` callback
is present, so the capability is advertised correctly (no false/forced
declaration).

### Logging (`notifications/message`) — intentionally not activated

1. The server runs **stateless Streamable HTTP** (`sessionIdGenerator: undefined`,
   a fresh server/transport per request, ADR for Cloud Run multi-instance). There
   is no persistent client session to stream operational log notifications to.
2. The compliance log of record is **Cloud Logging → GCS WORM (7-year)** per
   ADR-015, plus structured `pino` server logs. Adding a second, client-facing
   logging channel duplicates this with marginal benefit and PII-redaction risk.
3. Declaring a `logging` capability we do not meaningfully serve would be a
   false capability (violates the "no false capability" principle).

Revisit if/when a stateful transport or a streaming-progress UX is introduced.

### Pagination — not applicable to bounded catalogs

1. All list surfaces are small and bounded: 9 tools, ~4 resources, 3 resource
   templates, 3 prompts, and ≤ ~20 industry entries per template `list`.
2. The MCP SDK already emits `nextCursor` automatically for
   `tools/list` / `resources/list` / `prompts/list` **if** a page overflows; our
   counts never overflow a single page, so cursors are correctly absent.
3. `list_law_updates` exposes a domain `limit` (1–50) for result sizing.

Revisit if any catalog grows beyond a single practical page (e.g., a much larger
source index), at which point the template `list` callbacks would return opaque
cursors.

## Consequences

- Completion is now fully activated (templates + prompts); 5 of 7 primitives are
  genuinely activated, and the remaining 2 are documented deliberate scope
  decisions rather than gaps.
- No false capabilities are declared.
- `docs/ssw-compass-overview.md` and `docs/conformance-report.md` reflect this.

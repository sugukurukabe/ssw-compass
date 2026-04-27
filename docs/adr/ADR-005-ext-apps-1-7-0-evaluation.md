# ADR-005: @modelcontextprotocol/ext-apps 1.7.0 upgrade evaluation — stay on `^1.6.0`

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 2 kickoff pre-flight)
- **Deciders**: @kabe, SSW core team
- **Scope**: `apps/server/package.json`, `ui/ssw-search/package.json` — the two
  workspace packages that depend on `@modelcontextprotocol/ext-apps`

## Context

Sprint 2's kickoff protocol requires a version evaluation of
`@modelcontextprotocol/ext-apps` as a candidate upgrade target. The pre-flight
check produced the following facts (observed on npm registry and GitHub
Releases, 2026-04-27):

- **Latest stable**: **1.7.0**, published 2026-04-21.
- **SSW's current pin**: `^1.6.0` in both `apps/server/package.json` and
  `ui/ssw-search/package.json`.
- **Effective resolved version**: **1.7.0** in every workspace.
  `^1.6.0` satisfies 1.7.0 under semver, and `.npmrc` `node-linker=hoisted`
  places the single resolved copy at `node_modules/@modelcontextprotocol/ext-apps`.
  Verified via inspection of the installed `package.json` and
  `pnpm why -r @modelcontextprotocol/ext-apps`.

### 1.6.0 → 1.7.0 changes (2026-04-21 release)

Source: GitHub Releases page for `modelcontextprotocol/ext-apps`, v1.7.0.

#### Additions (API-additive, non-breaking)

- `App.registerTool()` / `sendToolListChanged()` — Views can expose tools
  for the Host to call (WebMCP-style pattern) (#72).
- `App.createSamplingMessage()` — sampling support via stock SDK types (#530).
- **Handshake-ordering guards** — `App` host-bound methods emit
  `console.warn` when called before `connect()` completes; one-shot event
  handlers (`ontoolinput`/`ontoolresult`/etc.) warn when first registered
  after `connect()`; `AppBridge` warns on requests arriving before
  `ui/notifications/initialized`. All warnings only; with
  `AppOptions.strict: true` the same conditions throw instead
  (#623, #629, #625, #630, #631).
- **`AppOptions.allowUnsafeEval`** (default `false`) — the `App` constructor
  calls `z.config({ jitless: true })` so Views operate under strict CSP
  without `'unsafe-eval'`. Opt in to the faster JIT path by passing `true`
  (#618).
- `useApp()` forwards `autoResize` and `strict` to the underlying `App`
  (#622). React-only; SSW does not use it (see ADR-004).

#### Fixes (non-breaking)

- `useApp` effect cleanup now closes the `App`, so React StrictMode's
  dev double-invoke no longer leaves a zombie `PostMessageTransport`
  listener (#631). React-only.
- `csp` / `permissions` typed `?: never` on `McpUiToolMeta`, so misplaced
  declarations fail at compile time (#624). SSW uses
  `McpUiResourceConfig.csp` on the **resource** side, not
  `McpUiToolMeta.csp` on the tool side, so this change does not affect
  our code paths.
- Drop stale `resourceUri` JSDoc referencing the deprecated flat
  `_meta["ui/resourceUri"]` key (#626). SSW already uses the nested
  `_meta.ui.resourceUri` form everywhere (Sprint 1 code review confirms).

#### Chore

- `npm run bump` version-bump script, prerelease publishing via `--tag beta`
  (#568).
- Pre-commit hook fixes: skip `link-self` on symlink targets,
  `--diff-filter=d` for deletion re-stage (#621).
- Bump `vite` / `hono` / `@hono/node-server` to patched versions (#616).
- Examples policy added to `CONTRIBUTING.md` (#550).

### Impact assessment on SSW code

Every change in 1.7.0 is either additive or targets APIs SSW does not use.
`z.config({ jitless: true })` (from `allowUnsafeEval: false`) happens to
pre-align us with the Sprint 3 CSP hash migration (no `'unsafe-eval'`).
No SSW source file needs to change to consume 1.7.0 — it has already been
running at 1.7.0 since Sprint 1.

### Alternative considered: narrow the pin to `^1.7.0`

Rejected. Reasons:

1. Functionally identical to the current state (both ranges resolve to 1.7.0).
2. Narrowing reduces the semver flexibility of automatic absorption of 1.8.x
   patches if the maintainers publish follow-ups.
3. Adds noise to `package.json` diffs for zero runtime effect.
4. Sprint 2's intent is to deliver two new tools plus real Vertex AI Search
   wiring; non-functional version grooming does not belong in that scope.

## Decision

Keep `@modelcontextprotocol/ext-apps` pinned at `^1.6.0` in both
`apps/server/package.json` and `ui/ssw-search/package.json`. Do **not**
narrow, widen, or otherwise alter the range in Sprint 2.

## Consequences

Positive:

- Sprint 2 can focus on new tool implementation, real Vertex AI Search
  wiring, and the Commit Moment UI — none of which require an ext-apps
  version change.
- `^1.6.0` retains the flexibility to absorb an eventual 1.8.x release
  without another ADR.
- SSW is already running the latest tested minor (1.7.0) at runtime, so
  we gain the handshake-ordering guards, `jitless` CSP alignment, and
  McpUiToolMeta strictness without a code change.

Negative / follow-up:

- `package.json` pin displays `^1.6.0` while `pnpm-lock.yaml` and the
  installed node_modules show 1.7.0. This cosmetic mismatch is harmless
  but could confuse a reader who does not read this ADR.
- Re-evaluate at each of:
  - **Sprint 3 kickoff** — check for 1.8.0 or higher, re-read release
    notes, apply the same non-breaking / breaking classification to
    decide whether to narrow the pin.
  - **Any 2.0.0 release** — major-bump of ext-apps will almost certainly
    involve breaking changes; hold an explicit ADR before migrating.

## Related

- **ADR-002** — UI Resource sample errata; documents how SSW already
  consumes ext-apps 1.7.0's real API (`PostMessageTransport(window.parent,
  window.parent)`, `params.structuredContent` direct access, no
  `onteardown`).
- **ADR-004** — React-free UI stack; explains why 1.7.0's React-only
  additions (`useApp` improvements) do not affect SSW.
- `docs/sprint-3-pending.md` — Sprint 3 entry point; this ADR's
  "Re-evaluate at Sprint 3 kickoff" obligation belongs there as a
  follow-up.

# ADR-008: `process.env` index-access convention + disable biome `useLiteralKeys`

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 3 Batch 1)
- **Deciders**: @kabe, SSW Compass core team
- **Scope**: [biome.json](../../biome.json),
  [.cursor/rules/01-code-standards.mdc](../../.cursor/rules/01-code-standards.mdc),
  all TypeScript source that reads environment variables (current: 6 files
  under `apps/server/`). No runtime code changes.

## Context

At Sprint 3 Batch 1 kickoff, `pnpm exec biome check apps packages ui`
reports the following per [biome.json](../../biome.json) defaults:

```
Found 5 warnings.
Found 34 infos.
```

All 34 infos are `lint/complexity/useLiteralKeys` — Biome's "prefer
`obj.key` over `obj["key"]`" rule. They partition across the codebase as:

| File | Hits | Kind of access |
|---|---|---|
| `apps/server/src/otel.ts` | 4 | `obj["code"]` / `obj["message"]` on a runtime-narrowed `Record<string, unknown>` (error payload extraction) |
| `apps/server/src/logger.ts` | 2 | `process.env["K_REVISION"]`, `process.env["LOG_LEVEL"]` |
| `apps/server/src/ui-assets.ts` | 1 | `process.env["UI_DIST_ROOT"]` |
| `apps/server/src/vertex.ts` | 6 | `process.env["SSW_VERTEX_MODE" \| "SSW_VERTEX_PROJECT" \| "SSW_VERTEX_LOCATION" \| "SSW_VERTEX_COLLECTION" \| "SSW_VERTEX_DATA_STORE_ID" \| "SSW_VERTEX_SERVING_CONFIG_ID"]` |
| `apps/server/src/index.ts` | 1 | `process.env["PORT"]` |
| `apps/server/test/vertex.test.ts` | 20 | test setup / teardown manipulating the same `SSW_VERTEX_*` keys |
| **Total** | **34** | |

`tsconfig.json` has `strict: true` and `noUncheckedIndexedAccess: true`.
Under this flag `process.env.KEY` and `process.env["KEY"]` produce the
**same** type (`string | undefined`) — the literal-key auto-fix Biome
offers is a pure style change with no type-safety delta.

The rule noise becomes a Sprint 3 problem for a specific reason: Batches 5
(CSP hash + DLP + output sanitizer) and 6 (VPC + Cloud Armor + WAF) add
**new** secure-coding lint categories that we will *actually* want to
read carefully. `34 infos` buried under cosmetic suggestions conditions
the eye to skip the Biome output; the first real `noGlobalObjectCalls`
or `noDangerouslySetInnerHtml` would be missed alongside.

A convention decision that has been sitting implicit in the codebase
since Sprint 1 needs to be written down before Sprint 3 expands the
surface: 100 % of real runtime `process.env.*` read sites use index
access today (30 / 30, treating the 4 `ui/*/vite.config.ts` `define:`
string-key entries as build-time not runtime). The codebase already
made this choice; the open task is only to document it and stop Biome
from advising against it.

## Decision

1. **Adopt index-access as the SSW Compass convention** for all
   `process.env.*` reads and for any `Record<string, unknown>` narrowing
   where the key is a string literal.

   ```typescript
   const mode = process.env["SSW_VERTEX_MODE"];   // convention
   // not: process.env.SSW_VERTEX_MODE
   ```

2. **Disable `lint/complexity/useLiteralKeys` globally** in
   [biome.json](../../biome.json) under `linter.rules.complexity`. Single
   rule disable, no per-file override.

3. **Document the convention** in
   [.cursor/rules/01-code-standards.mdc](../../.cursor/rules/01-code-standards.mdc)
   so future contributors see the rule before they see the Biome
   override, not the other way round.

4. **No source-file edits.** The rule is being turned off, not satisfied.
   Every current access site is already conformant; no auto-fix is run.
   Test runs, UI builds, and the `apps/server` Cloud Run startup path
   all stay byte-identical after this batch.

## Rationale

1. **Semantic honesty under `noUncheckedIndexedAccess`.** The flag
   narrows `process.env` to `Record<string, string | undefined>`. Bracket
   notation on an index-access map *reads* as "lookup with a possibly
   missing key", which matches the runtime contract. Dot notation *reads*
   as "known structural property", which matches `Record`-typed access
   only by coincidence.
2. **Grep discipline.** `process\.env\["[A-Z_]+"\]` is a single regex
   that finds 100 % of current access sites in 3 ms. `process\.env\.[A-Z_]+`
   and `process\.env\["[A-Z_]+"\]` as a union costs nothing to write
   but doubles the surface reviewers need to remember for security
   audits. Sprint 3 Batch 5 (Cloud DLP + output sanitizer) and Batch 6
   (URL allowlist) will add more security-relevant greps; keeping the
   `process.env` pattern single-form reduces the audit checklist
   exponent.
3. **One-way migration.** If Sprint 3 surfaces a real reason to prefer
   dot-notation (e.g., a TypeScript-native static analyser that reads
   literal keys better than brackets), the auto-fix is still available
   — Biome's `useLiteralKeys` remains implemented, it is only muted
   at our config layer. Re-enabling it would flag every access site
   in one biome run, so reverting this ADR is a 5-minute task.
4. **Matches existing non-`process.env` narrowing in `otel.ts`.** The
   `obj["code"]` / `obj["message"]` pattern narrows an error payload of
   unknown shape. Using dot notation there would require a typed
   interface for error payloads we deliberately do not have (errors
   from the SDK, from OpenTelemetry, and from user tool handlers all
   arrive with heterogeneous shapes). The rule muting is coherent with
   this pattern, not a process.env-only carve-out.

## Alternatives rejected

### Option B — dot notation everywhere

Auto-fix the 34 sites to `process.env.K_REVISION` / `obj.code` / etc.
Keep `useLiteralKeys` enabled as a guardrail.

Rejected because:

- Requires a new module-scoped `env(key: string): string | undefined`
  helper for any environment variable whose name is computed at runtime
  (Sprint 3 Batch 4 Vertex ingestion pipeline and Batch 6 Cloud Armor
  URL allowlist both need runtime env lookups). Adding the helper is
  not free; it is an extra indirection reviewers must chase through.
- Forces the `otel.ts` error-payload narrowing to adopt dot notation
  on a `Record<string, unknown>` — which Biome's own `useLiteralKeys`
  auto-fix produces, but which is legitimately harder to read when the
  cast is to "unknown shape, here are the keys I checked for".
- Bundle size, runtime behaviour, and type safety are identical
  between Option A and Option B. The choice is purely stylistic.

### Option C — keep the rule enabled, accept the 34 infos

Rejected because Sprint 3 adds Cloud DLP, output sanitizer, CSP hash,
URL allowlist, and Cloud Armor rule changes in Batches 5 – 6. Each of
these can surface new Biome diagnostics that we need to read
individually and triage. Burying real warnings under 34+ `useLiteralKeys`
infos is a measurable attentional cost during the most
security-sensitive Sprint of the project. This is the same reasoning
that kept `suspicious.noExplicitAny` at `error` rather than `warn`.

### Option D — per-file override via `overrides` block in `biome.json`

Rejected because the scope (which files should use index access) is
not obviously bounded. Today it is 6 files. Sprint 3 Batch 2 adds
Terraform-adjacent TypeScript (e.g., ingestion script) that will read
`process.env` too, and the convention would be silently broken by any
new file that did not get added to the override list.

## Consequences

### Positive

- `pnpm exec biome check` output drops from `Found 5 warnings. Found 34 infos.`
  to `Found 5 warnings. Found 0 infos.` (the 5 warnings are the
  `suppressions/unused` and `noNonNullAssertion` set tracked separately;
  they are not touched by this ADR).
- CI noise at the Biome stage is eliminated for the remainder of
  Sprint 3. The first time a Sprint 3 commit reintroduces `infos`, it
  will be a real new signal, not accumulated style debt.
- Onboarding: the `## Environment variables` section of
  `01-code-standards.mdc` is now a short deterministic rule rather than
  "see existing code for style".

### Negative / follow-up

- We lose Biome's auto-fix suggestion for the rare future case where a
  dynamic-key bracket access could have been proven static. Mitigated
  by the grep discipline noted above; a future ADR can re-enable the
  rule in targeted directories if this becomes material.
- `useLiteralKeys` is a Biome recommended rule. Turning it off moves us
  slightly off the upstream default. Mitigated by documenting the
  decision here and in `01-code-standards.mdc`; the next Biome major
  version-bump ADR (if any) will reference this as a retained
  override.

## Verification performed

- `pnpm exec biome check apps packages ui --max-diagnostics=100`
  before: `Found 5 warnings. Found 34 infos.`
- `pnpm exec biome check apps packages ui --max-diagnostics=100`
  after: `Found 5 warnings. Found 0 infos.` (see Batch 1 validation
  block in `docs/sprint-3-pending.md` after this ADR lands).
- `pnpm run typecheck` — 9/9 tasks successful, no change.
- `pnpm -F @ssw/server test` — 60/60 passed, no change.
- `git grep -E 'process\.env\.[A-Z_]' -- 'apps/**/*.ts' 'packages/**/*.ts'`
  returns zero hits (confirms the convention is already followed
  everywhere that matters).

## Related

- [ADR-001: pino v10 upgrade](./ADR-001-pino-v10-upgrade.md) — another
  lint-configuration-adjacent decision, recorded as precedent for how
  we document tool-configuration trade-offs.
- [ADR-002: v2 §6.1 spec errata](./ADR-002-v2-section-6-1-spec-errata.md)
  — the `exactOptionalPropertyTypes` flag cited here is configured in
  the same `tsconfig.json`.
- [ADR-007: Brand renaming](./ADR-007-brand-renaming.md) — established
  the `SSW_*` env var prefix that now populates 26 of the 34 current
  access sites.
- [biome.json](../../biome.json) — configuration being updated.
- [.cursor/rules/01-code-standards.mdc](../../.cursor/rules/01-code-standards.mdc)
  — rule doc being updated.

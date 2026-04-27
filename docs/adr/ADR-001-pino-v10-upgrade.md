# ADR-001: Upgrade pino to v10 in the server workspace

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 1, Batch 2 rework)
- **Deciders**: @kabe, VCJ core team
- **Supersedes**: partially overrides `docs/specs/v2-comprehensive-design.md` §4.2 `pino` pin

## Context

`docs/specs/v2-comprehensive-design.md` §4.2 pins `pino: ^9.5.0`. During
Batch 2 implementation we discovered that `@google-cloud/pino-logging-gcp-config`
version **1.3.3** — the latest release and the version that satisfies the
spec's loose `^1.x` range for that package — declares `pino: ^10.3.1` as a
**direct** dependency (not a peer dependency).

Because `.npmrc` uses `node-linker=hoisted`, the effective resolution was:

```
pino@9.14.0
└── @vcj/server@1.0.0              (spec-declared, ^9.5.0)

pino@10.3.1
└─┬ @google-cloud/pino-logging-gcp-config@1.3.3
  └── @vcj/server@1.0.0              (transitive, ^10.3.1 wins the hoist)

Found 2 versions of pino
```

`node_modules/pino/` resolved to **10.3.1** at runtime. Two concrete problems
followed:

1. **Type incompatibility at the `pino()` call site.** `createGcpLoggingPinoConfig`
   returns `pino.LoggerOptions<never, boolean>` (pino v10's default generic
   `CustomLevels = never`), but our `import { pino } from "pino"` in
   `apps/server/src/logger.ts` infers `LoggerOptions<string, boolean>` at the
   call site. Under `exactOptionalPropertyTypes: true`, `MixinFn<never>`
   is not assignable to `MixinFn<string>` and `tsc --noEmit` fails.
2. **Silent spec divergence.** The declared `^9.5.0` is effectively inert:
   runtime and types come from v10 regardless. Any pino v9-specific change we
   might make (behavioral assumptions, minor API) would not actually be
   exercised.

Alternative considered: **pin `@google-cloud/pino-logging-gcp-config` to
`^1.2.0`** (last release on the pino v9 track). Rejected because (a) it
locks us out of 1.3.x bug fixes from Google and the evolving GCP Cloud
Logging formatter, and (b) pino v9 is itself approaching EOL while v10
(released 2024-10) is the current LTS track.

Another alternative considered: **remove `@google-cloud/pino-logging-gcp-config`
and format GCP-compatible JSON by hand.** Rejected for maintenance cost.

## Decision

1. Upgrade `apps/server/package.json` dependency `pino` from `^9.5.0` to
   **`^10.3.1`**.
2. Keep `@google-cloud/pino-logging-gcp-config` at `^1.3.3`.
3. Remove the `as LoggerOptions` type cast from
   `apps/server/src/logger.ts`. Types flow cleanly when a single pino
   version is in the dependency graph.
4. Remove the `cross-env` devDependency. VCJ targets macOS (dev) and Cloud
   Run Linux (prod) only; a bare `MCP_TRANSPORT=stdio tsx ...` prefix
   is sufficient and matches spec §4.2's exact script string.

## Consequences

Positive:

- `pnpm why -r pino` now reports **"Found 1 version of pino"** (10.3.1).
- `apps/server/src/logger.ts` compiles cleanly under
  `exactOptionalPropertyTypes: true` with **no type suppression**.
- GCP Cloud Logging formatter tracks Google's latest fixes.
- VCJ follows the pino v10 LTS track instead of approaching EOL on v9.

Negative / follow-up:

- `docs/specs/v2-comprehensive-design.md` §4.2 now carries an
  intentionally stale `pino: ^9.5.0` pin. A future v2 ADR (or v2
  revision) must correct this; captured here as the authoritative
  product-level record in the meantime.
- Any future pino v11 major bump requires coordinated upgrade with
  `@google-cloud/pino-logging-gcp-config` (and potentially a follow-up
  ADR) rather than a silent `^`-range satisfaction.

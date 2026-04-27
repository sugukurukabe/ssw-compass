# ADR-006: Vertex AI Search — fixture / real dispatch via `SSW_VERTEX_MODE`

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 2, Batch 4)
- **Deciders**: @kabe, SSW core team
- **Scope**: `apps/server/src/vertex.ts`, the sole retrieval seam for every
  SSW tool (`search_visa`, `classify_procedure`, `get_deadline_timeline`)

## Context

Sprint 2 Batch 4 introduces the real
`@google-cloud/discoveryengine.SearchServiceClient` integration. However,
Sprint 2's scope explicitly stops at "localhost-only wiring" — the Cloud
Run deploy, Terraform-driven data store provisioning, VPC egress controls
(v3 §23.2), and BYOSA / Workload Identity are all Sprint 3 work.

Three operating contexts need to coexist:

1. **Local development** — usually no GCP credentials available;
   developer runs `pnpm -F @ssw/server dev` and expects tools to return
   something useful via fixture data.
2. **CI (Sprint 3)** — deterministic vitest runs without any GCP reach;
   must be able to execute the same code path that production would,
   with a mocked client.
3. **Production (Sprint 3)** — Cloud Run service with BYOSA credentials
   (Application Default Credentials flow), configured with
   project/location/collection/data store IDs set via Secret Manager
   volume mounts.

The retrieval seam (`vertexSearch`) is imported by three handlers that
must not change when the backend flips from fixture to real. The
`VertexSearchArgs` / `VertexSearchResult` / `GroundedChunk` contract is
frozen at Sprint 1 Batch 3.

Three dispatch strategies were considered:

| Strategy | Pros | Cons |
|---|---|---|
| **A. Always real** — delete fixture | Single code path in production | Breaks localhost dev + CI; blocks Sprint 2 completion since no data store exists yet |
| **B. Auto-detect credentials** — try ADC, fall back to fixture silently | Zero configuration | Silent fallback masks misconfiguration in production; hard to audit whether a given response came from the real data store or a dev fixture |
| **C. Explicit env flag** (chosen) | Loud failures on misconfiguration; testable; deployable in stages | One extra env var to set |

Strategy B was rejected primarily on auditability grounds: once SSW ships
to Connectors Directory (Sprint 4), we must be able to answer "was this
a real retrieval or a stub?" from the logs alone. A silent-fallback
design cannot answer that reliably.

## Decision

1. Dispatch on `SSW_VERTEX_MODE` env var. Accepted values: `"real"`. Any
   other value (including unset / empty / any typo) resolves to
   `"fixture"`. This makes local dev the safe default.

2. When `SSW_VERTEX_MODE=real`, five additional env vars are **required**:
   - `SSW_VERTEX_PROJECT` — GCP project ID
   - `SSW_VERTEX_LOCATION` — region (e.g., `asia-northeast1`)
   - `SSW_VERTEX_COLLECTION` — Discovery Engine collection
     (typically `default_collection`)
   - `SSW_VERTEX_DATA_STORE_ID` — data store ID (Sprint 3 will create
     `visa_legal` / `visa_faq` / `visa_secondary` per v2 §10)
   - `SSW_VERTEX_SERVING_CONFIG_ID` — serving config ID (typically
     `default_serving_config`)

   Any missing value makes `vertexSearch` **throw synchronously** at the
   first call, with a message listing exactly which vars are missing. No
   silent fallback to fixture.

3. `confidence` is fixed at **0.9** for both fixture and real branches in
   Sprint 2. Real data-store-side relevance scoring and threshold
   calibration is deferred to Sprint 3, where it belongs with the data
   store provisioning.

4. The source allowlist (passed in `VertexSearchArgs.sourceAllowlist`, e.g.,
   `["*.go.jp"]`) is applied as a **post-filter** on the real branch.
   Results whose `document.derivedStructData.link` (or `structData.uri`)
   host does not match any pattern are dropped before returning. This
   mirrors the Sprint 1 design intent and is cheaper than configuring
   per-data-store source filters during Sprint 2.

5. The `SearchServiceClient` instance is **lazy-instantiated and cached**
   via a module-level variable. A test-only setter
   (`__setSearchClientForTesting`) is exported with an underscore prefix
   (stable API convention signalling "do not call from production code")
   so vitest can inject a mock. A more idiomatic DI refactor is Sprint 3
   work if it becomes necessary.

6. Tests run with `SSW_VERTEX_MODE` explicitly cleared/set per case, so
   repeat executions are deterministic.

## Consequences

Positive:

- Localhost `pnpm -F @ssw/server dev` keeps working with zero config
  changes; existing three tools continue to return the two MOJ fixture
  chunks.
- CI (Sprint 3) can exercise both the fixture path (default) and the
  real path (via `__setSearchClientForTesting` + env vars) with complete
  determinism.
- Cloud Run deploy (Sprint 3): ship the container with
  `SSW_VERTEX_MODE=real` and the five env vars mounted from Secret
  Manager. No code change needed.
- Any misconfigured deploy fails loudly on the first MCP `tools/call`,
  making incidents obvious rather than silently degrading to fixture
  data.
- Handler sites (`search-visa`, `classify-procedure`,
  `get-deadline-timeline`) were not modified; the contract boundary held.

Negative / follow-up:

- Sprint 3 must:
  - Move real-mode env vars into Secret Manager + Cloud Run
    `--set-secrets` bindings (v2 §8.4).
  - Configure Terraform for the three data stores
    (visa_legal / visa_faq / visa_secondary) and wire
    `confidenceThreshold` into a real scoring pipeline.
  - Replace this module's `confidence: 0.9` placeholder with a value
    derived from the data-store-side relevance signal (v2 §10).
  - Layer the v3 §23.1 output sanitizer and the v3 §23.2 egress
    controls (VPC connector + Cloud NAT + `safeFetch`) around the real
    branch.
- `__setSearchClientForTesting` is a deliberate testing seam; if SSW's
  DI pattern matures in Sprint 3+, revisit whether to replace it with a
  constructor-injected client or a factory.
- The `as unknown as SearchClientLike` cast bridges the full SDK type
  to the minimal shape we actually call. This is an intentional trade:
  tests become small and reliable; the cost is that accidental use of an
  un-typed method on the SDK goes undetected. Future minor upgrades of
  `@google-cloud/discoveryengine` that change the `search` method shape
  should be caught by the vitest cases and the server's compile pass.

## Related

- **ADR-005** — ext-apps stay-on-1.6.0 evaluation (parallel Sprint 2
  dispatch policy for a different third-party API surface).
- `docs/specs/v2-comprehensive-design.md` §8.4 (Secret Manager + volume
  mount + version pinned — where real-mode env vars will live in
  Sprint 3).
- `docs/specs/v2-comprehensive-design.md` §10 (Vertex AI Search
  grounding integrity — the scoring-tuning follow-up named here).
- `docs/specs/v3-supplement.md` §23.2 (VPC connector + Cloud NAT +
  `safeFetch` egress allowlist — surrounds the real branch in Sprint 3).
- `docs/sprint-3-pending.md` — "Vertex AI Search 実接続" section is now
  partially resolved by Batch 4; Sprint 3 owns the production hardening
  pass.

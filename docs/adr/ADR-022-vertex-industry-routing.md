# ADR-022: Vertex industry routing and source ranking

## Status

Accepted

## Context

Production verification showed that an agriculture query returned many source
cards from non-agriculture ministries. This is not a Cloud Run or Claude issue;
it is a retrieval design issue.

Current behavior:

- `search_visa` builds a query from category, industry, and optional
  year-month.
- `vertexSearch()` receives `sourceAllowlist: ["*.go.jp"]`.
- `sourceAllowlist` only filters hostnames, so MAFF, MOJ, MHLW, MLIT, MIC,
  and other `.go.jp` hosts all pass.
- The Discovery Engine data store contains cross-ministry pages, so
  agriculture queries can rank general immigration or other-sector documents
  above MAFF-specific documents.
- `data/source-index.jsonl` already contains useful `ministry` and `tags`
  metadata, but this metadata is not used at query time.
- Real-mode confidence is still fixed at `0.9`, making the handler-level
  `confidenceThreshold >= 0.7` rule ineffective for ranking decisions.

The project constraint remains primary-source only:

- only `primary_source`
- confidence >= 0.7
- no fallback to LLM knowledge

## Decision

Introduce deterministic industry routing in front of Vertex results.

### 1. Add an industry routing table

Create a single source of truth mapping SSW industries to ministries, host
allowlists, and recommended tags.

Example shape:

```ts
type IndustryRoute = {
  industry: string;
  primaryMinistries: string[];
  preferredHostPatterns: string[];
  preferredTags: string[];
};
```

Initial routing examples:

| Industry | Primary ministries | Preferred hosts |
|---|---|---|
| agriculture | `maff`, `moj` | `www.maff.go.jp`, `www.moj.go.jp` |
| fishery | `maff`, `moj` | `www.jfa.maff.go.jp`, `www.maff.go.jp`, `www.moj.go.jp` |
| construction | `mlit`, `moj` | `www.mlit.go.jp`, `www.moj.go.jp` |
| nursing_care | `mhlw`, `moj` | `www.mhlw.go.jp`, `www.moj.go.jp` |
| food_service | `maff`, `moj` | `www.maff.go.jp`, `www.moj.go.jp` |
| lodging | `mlit`, `moj` | `www.mlit.go.jp`, `www.moj.go.jp` |
| automobile_repair | `mlit`, `moj` | `www.mlit.go.jp`, `www.moj.go.jp` |
| aviation | `mlit`, `moj` | `www.mlit.go.jp`, `www.moj.go.jp` |
| shipbuilding | `mlit`, `moj` | `www.mlit.go.jp`, `www.moj.go.jp` |

MOJ remains allowed because immigration procedure pages are cross-cutting and
often legally controlling. Sector ministries are preferred for sector-specific
rules and forms.

### 2. Extend `VertexSearchArgs`

Add optional routing metadata:

```ts
interface VertexSearchArgs {
  query: string;
  datastore: string;
  confidenceThreshold: number;
  sourceAllowlist: readonly string[];
  preferredMinistries?: readonly string[];
  preferredTags?: readonly string[];
  maxChunks?: number;
}
```

The public handler contract stays stable; only server internals change.

### 3. Filter and rank after Vertex retrieval

Filtering order:

1. URI host must match `sourceAllowlist`.
2. If `preferredMinistries` or `preferredTags` are provided, apply a deterministic
   score bonus to matching documents.
3. Drop chunks below `confidenceThreshold` once real model scores are mapped.
4. Cap returned chunks to the tool's UX need (`search_visa` default 3-5, not 30+).

Until model-score mapping is implemented, `confidence` remains a typed field
but must not be presented as a meaningful business guarantee. The UI should say
"official sources found", not "90% confident".

### 4. Use `data/source-index.jsonl` metadata

`data/source-index.jsonl` already carries:

- `id`
- `url`
- `ministry`
- `tags`
- `trustLevel`
- `status`
- `contentSha256`

Runtime should load a compact index of URL -> metadata at startup, or generate
a TypeScript fixture during build in a later sprint. Sprint 5 can start with a
small runtime parser for the JSONL file and memoize it.

### 5. Search UI no longer defaults to source cards

Routing improves result relevance, but the UX still follows ADR-021: sources
are collapsed by default.

## Alternatives rejected

### A. Query text only

Adding "agriculture MAFF" to the query may help ranking but does not create a
hard product guarantee. The user complaint is about non-agriculture results
surfacing as primary cards.

### B. Separate data store per industry

This gives strong filtering but increases Terraform, ingestion, and operations
surface area. It also duplicates cross-cutting MOJ documents across stores.

### C. Only host allowlists

Host allowlists can distinguish `maff.go.jp` from `mlit.go.jp`, but procedure
queries often need both sector ministry and MOJ. A route table is more precise
than host-only filtering.

### D. Remove Vertex from workflow tools

The classifier and checklist should be rule-first, but Vertex still has value
for official-source lookup, law updates, and freshness warnings. The correct
fix is routing and UX scoping, not removal.

## Consequences

- `search_visa` agriculture results will favor MAFF + MOJ, not unrelated
  sector ministries.
- Tool outputs become shorter and more task-focused.
- `data/source-index.jsonl` becomes a runtime metadata dependency, so CI must
  catch malformed JSONL.
- The confidence-score TODO in `vertex.ts` becomes a Phase A/B acceptance item.
- Future crawlers can update metadata without changing handler logic.


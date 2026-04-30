# ADR-023: GCS metadata NDJSON ingestion for Agent Search

## Status

Accepted

## Context

SSW Compass currently imports official-source documents into Discovery Engine
using inline document import from `scripts/ingest-sources.ts`. That path proved
the production flow, but it does not match the current Agent Search
prepare-data guidance:

- unstructured Cloud Storage import with metadata should use JSONL/NDJSON rows
  containing `id`, `content.mimeType`, `content.uri`, and either `structData`
  or `jsonData`;
- dynamic URLs should be excluded and canonical URLs should be used;
- smaller, targeted data stores are preferred over a single large data store;
- layout-aware chunking and layout parsing must be enabled when the data store
  is created and cannot be enabled retroactively;
- native layout-based chunking supports `chunkSize` 100-500 tokens, so the
  common 512/1024-token RAG strategy is not directly available unless using
  bring-your-own chunks.

The project also has non-negotiable constraints:

- primary sources only;
- no PII handling;
- no legal representation;
- public, read-only, anonymous connector;
- Japanese SSW / related visa scope only.

The user requested a more robust GCS + Vertex AI RAG architecture that can
eventually support official documents, GitHub issues, and developer context.

## Decision

Move SSW official-source ingestion from inline raw document import to
GCS-backed Agent Search metadata NDJSON, while separating public visa data from
developer context.

### 1. GCS-backed metadata import

Prepared raw documents are stored in a non-WORM GCS bucket:

```text
gs://ssw-compass-rag-raw-<env>/official/<ministry>/<docId>/<sha256>.<ext>
```

Metadata import manifests are stored separately:

```text
gs://ssw-compass-rag-metadata-<env>/metadata/<runDate>/<dataStore>.ndjson
```

Each metadata row follows the Agent Search unstructured metadata format:

```json
{
  "id": "moj-isa-ssw-overview",
  "structData": {
    "title": "特定技能制度 総合案内",
    "canonicalUrl": "https://www.moj.go.jp/isa/applications/ssw/index.html",
    "ministry": "moj",
    "tags": ["ssw_1", "ssw_2", "overview"],
    "trustLevel": "primary_source"
  },
  "content": {
    "mimeType": "text/html",
    "uri": "gs://ssw-compass-rag-raw-prod/official/moj/moj-isa-ssw-overview/<sha>.html"
  }
}
```

### 2. Data store split

Use v2 data stores instead of mutating existing ones, because chunking cannot
be enabled after creation.

Initial v2 stores:

- `visa_legal_core_v2`
- `visa_forms_v2`
- `visa_faq_v2`
- `visa_law_updates_v2`

`dev_context_v2` is reserved for a future private developer MCP. It must not be
mixed into the public SSW connector.

### 3. Native chunking first

Create v2 data stores with:

- layout-aware document chunking;
- `chunkSize = 500`;
- `includeAncestorHeadings = true`;
- layout parser enabled;
- excluded HTML elements: `header`, `footer`, `nav`, `aside`.

This follows the Agent Search native limit of 100-500 tokens. Larger
1024-token chunks are deferred until bring-your-own chunks are approved and
designed.

### 4. Canonical URL and dynamic URL policy

Every source entry must have `canonicalUrl`. Dynamic URLs with query strings,
fragments, search pages, or session-like parameters are rejected before
ingestion unless explicitly allowlisted.

### 5. Runtime metadata routing

The MCP server should route and rank using metadata:

- `ministry`
- `tags`
- `dataStoreGroup`
- `canonicalUrl`
- `sourceType`

Host allowlists remain as a safety layer, not as the primary relevance layer.

### 6. Developer context is deferred and separate

GitHub issues, PRs, release notes, and internal developer docs are useful for
engineering agents but out of scope for the public SSW connector. They belong
in a separate `ssw-dev-mcp` or private admin-only connector in Sprint 7+.

## Alternatives rejected

### A. Keep inline import

Inline import is simple but does not scale, does not give a stable GCS audit
trail of imported documents, and cannot handle large files well.

### B. Mutate existing data stores in place

Chunking cannot be enabled after data store creation. Mutating existing stores
risks downtime and unclear provider drift. New v2 stores are safer and provide
an env-var rollback path.

### C. One large unified data store

Google recommends smaller targeted stores for latency and quality. SSW also
needs tool-specific retrieval boundaries, especially for forms versus law
updates.

### D. Mix GitHub/dev context into public SSW data

This would confuse public users, complicate submission review, and introduce
private-data risk. Rejected for the public connector.

## Consequences

- Ingestion becomes a two-step prepare/import flow.
- Terraform adds non-WORM RAG buckets and v2 Agent Search stores.
- Runtime can gradually flip by environment variable without deleting old
  stores.
- Submission quality improves because search results become more relevant and
  source metadata is explicit.
- BYO chunking remains future work.


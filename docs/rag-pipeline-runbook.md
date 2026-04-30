# RAG Pipeline Runbook — GCS + Agent Search v2

> Based on ADR-023. This runbook intentionally separates prepare, import, and
> serving flip so rollback stays simple.

## Preconditions

- Terraform v2 data stores have been applied.
- RAG buckets exist:
  - `ssw-compass-rag-raw-<env>`
  - `ssw-compass-rag-metadata-<env>`
- `GOOGLE_OAUTH_ACCESS_TOKEN` is set for GCS upload.
- `CLOUDSDK_CORE_PROJECT=ssw-compass-prod-494613`.

## 1. Validate source index

```bash
pnpm validate:source-index
```

This checks:

- dynamic URL exclusion
- canonical URL duplication
- primary-source-only trust level
- routing group validity

## 2. Prepare GCS documents and metadata

Dry-run first:

```bash
pnpm prepare:rag -- --dry-run --env=staging --filter=visa_forms
```

Then upload:

```bash
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
pnpm prepare:rag -- --env=staging --filter=visa_forms
```

The script writes local metadata files:

```text
data/agent-search-<dataStoreId>.<runDate>.ndjson
```

and uploads raw documents + metadata manifests to GCS.

## 3. Import into Agent Search

Dry-run:

```bash
pnpm import:rag -- \
  --dry-run \
  --filter=visa_forms_v2 \
  --metadata-file=data/agent-search-visa_forms_v2.<runDate>.ndjson
```

Import:

```bash
pnpm import:rag -- \
  --filter=visa_forms_v2 \
  --metadata-file=data/agent-search-visa_forms_v2.<runDate>.ndjson
```

Repeat per data store.

## 4. Staging serving flip

Update Cloud Run env vars only after imports finish:

```bash
SSW_VERTEX_DATA_STORE_ID=visa_legal_core_v2
SSW_VERTEX_FORMS_DATA_STORE_ID=visa_forms_v2
SSW_VERTEX_FAQ_DATA_STORE_ID=visa_faq_v2
SSW_VERTEX_LAW_UPDATES_DATA_STORE_ID=visa_law_updates_v2
```

Then smoke:

```bash
MCP_URL="<staging-url>/mcp" pnpm smoke:mcp
```

## 5. Prod serving flip

Repeat the same prepare/import flow with `--env=prod`.

After deploy:

```bash
MCP_URL="https://mcp.ssw-compass.jp/mcp" pnpm smoke:mcp
```

Do not flip prod until all of the following are true:

- `pnpm validate:source-index -- --strict` is either clean or all warnings are
  explicitly accepted in the run report.
- `pnpm prepare:rag -- --dry-run --env=prod --filter=visa_forms` returns
  `failed=0`.
- Each v2 data store has a successful import LRO.
- Staging `MCP_URL=<staging>/mcp pnpm smoke:mcp` passes.
- Claude Web manual verification passes with the 5 screenshot prompts.

## Rollback

Rollback is one environment flip:

```bash
SSW_VERTEX_DATA_STORE_ID=visa_legal
SSW_VERTEX_FORMS_DATA_STORE_ID=visa_legal
SSW_VERTEX_FAQ_DATA_STORE_ID=visa_faq
SSW_VERTEX_LAW_UPDATES_DATA_STORE_ID=visa_legal
```

No v2 data store deletion is required.


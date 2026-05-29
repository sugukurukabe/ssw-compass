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

### 1b. Check URL health (公式 URL の死活確認 / periodic)

`data/source-index.jsonl` の全 URL の死活を確認し、`data/url-health-report.<date>.md` を生成する。
ingest 前と、最低でも月1回の定期実行を推奨 (公式サイトの URL は予告なく変わる)。

```bash
# report のみ (source-index は変更しない)
pnpm check:url-health

# source-index の status/lastRunAt も更新する場合
pnpm check:url-health -- --write
```

判定の読み方:

- **HTTP 403 / 401 (bot ブロックの可能性)**: 多くは自動アクセス拒否で、人間がブラウザで開けば
  有効な場合がある。即 withdrawn にせず、手動でブラウザ確認する。
- **HTTP 404 / 410 (恒久的消失の可能性)**: リンク切れの可能性が高い。一次ソースを再確認し、
  新しい canonical URL に差し替えるか `status: "withdrawn"` にする。
- **timeout**: ネットワーク／レート制限の可能性。再実行し、継続する場合のみ対処する。

失敗があると終了コード 1 を返すため、CI / 定期ジョブで検知できる
(常に 0 にしたい場合は `-- --allow-failures`)。

> 16 分野のカバレッジ拡充 (新規 URL 追加) と失敗 URL の差し替えは、
> 行政書士監修を伴う人手作業。`feat/ssw-16-industries-manual-sources` 等のブランチで
> 進め、監修サインオフ後に `main` へ取り込む (自動マージはしない)。

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


# 制度変動データセット 更新手順 / Law Updates Maintenance Runbook / Prosedur Pemeliharaan Pembaruan Peraturan

`list_law_updates` ツールが返す制度変動カレンダー (`KNOWN_LAW_UPDATES_FIXTURE`) を
最新の一次情報に保つための手順。スグクル社内で「最新の情報」を担保する運用の中核。

The procedure for keeping the law-updates calendar current against primary sources.
Prosedur untuk menjaga kalender pembaruan peraturan tetap mutakhir terhadap sumber resmi.

---

## なぜこの手順が必要か / Why / Mengapa

- 制度変動データは Sprint 4 時点で **ハードコード fixture** (`packages/shared-types/src/law-updates.ts`)。
- `status` (active / pending) は **リクエスト毎に `effective_date` と当日で自動再計算** されるため、
  施行日ベースの鮮度は常に正確。
- ただし **エントリ自体の追加・修正・撤回は手動**。新しい入管法改正・運用要領変更が出たら本手順で反映する。
- データの鮮度は `LAW_UPDATES_DATASET_REVIEWED_DATE` で公開され、`list_law_updates` の応答にも
  「データ最終確認日」として表示される。レビューから `LAW_UPDATES_STALE_AFTER_DAYS` (90日) を超えると
  サーバ起動時に `law_updates_dataset_stale` warning が出る。

---

## 更新頻度 / Cadence / Irama

- **定期**: 最低でも四半期に1回 (90日以内)、`LAW_UPDATES_DATASET_REVIEWED_DATE` を更新できるよう確認する。
- **随時**: 入管庁・所管省庁が新たな施行日／運用変更を公表したら即時反映。

---

## 手順 / Steps / Langkah

### 1. 一次ソースを確認する / Verify primary sources

以下を確認し、新規・変更・撤回された制度変動を洗い出す:

- 出入国在留管理庁: <https://www.moj.go.jp/isa/>
- 特定技能 制度関連ページ: <https://www.moj.go.jp/isa/applications/ssw/index.html>
- 各分野 所管省庁の運用要領 (農林水産省・国土交通省・厚生労働省・経済産業省 等)

> Anti-Hallucination: すべての `effective_date` / `announced_date` は一次ソースで確認すること。
> 確認できない日付・内容は `effective_date: "TBD"` + `status: "pending_verification"` とする。

### 2. fixture を編集する / Edit the fixture

`packages/shared-types/src/law-updates.ts` の `KNOWN_LAW_UPDATES_FIXTURE` を編集する。

各エントリは `LawUpdate` スキーマ (zod `.strict()`) に準拠すること:

- `id`: `^FY\d{4}-.+$` 形式 (例: `FY2026-immigration-act-73-2-stricter`)
- `effective_date`: `YYYY-MM-DD` または `TBD`
- `announced_date`: `YYYY-MM-DD`
- `category`: `fee_revision | immigration_act | industry_pause | form_revision | operational_guidance`
- `affecting_roles`: `host_company_hr | dispatch_company | support_org` から最低1件
- `impact_severity`: `info | minor | major | critical`
- `source_urls`: 一次ソース URL を最低1件 (可能な限り `*.go.jp`)
- `status`:
  - `pending` … 施行前・一次ソース確認済み
  - `pending_verification` … 日付/内容が未確認 (フィルタで除外される)
  - `withdrawn` … 撤回 (フィルタで除外される)
  - ※ `active` は自動計算されるため、手入力では `pending` のままで良い

### 3. レビュー日を更新する / Bump the reviewed date

`packages/shared-types/src/law-updates.ts` の
`LAW_UPDATES_DATASET_REVIEWED_DATE` を **本日の日付 (YYYY-MM-DD)** に更新する。

これを更新しないと、変更後も「データ最終確認日」が古いままになる。

### 4. テストと型チェック / Test and typecheck

```bash
pnpm -F @ssw/shared-types build
pnpm -F @ssw/server test
pnpm run typecheck
pnpm exec biome check packages apps
```

`active-filter.test.ts` の status 遷移テストと、`law-updates dataset freshness` テストが緑であること。

### 5. コミットしてデプロイ / Commit and deploy

```bash
git add packages/shared-types/src/law-updates.ts
git commit -m "feat(law-updates): <変更内容> + reviewed date を YYYY-MM-DD に更新"
git push
```

`main` への push で staging CD が走る。prod は `cd-prod.yml` を手動 dispatch して反映する。

### 6. 反映確認 / Verify in production

```bash
MCP_URL="https://mcp.ssw-compass.jp/mcp" pnpm smoke:mcp
```

`list_law_updates` を呼び、`structuredContent.datasetReviewedDate` が更新後の日付であること、
新規エントリが反映されていることを確認する。

---

## 将来計画 / Future / Masa depan

- Sprint 5 以降: `KNOWN_LAW_UPDATES_FIXTURE` を Vertex AI Search ingestion に移行し、
  一次ソースのクロール + 行政書士監修フローで半自動化する (ADR 別途起票)。
- それまでは本 runbook による手動更新が SSOT (Single Source of Truth)。

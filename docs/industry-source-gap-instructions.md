# 16分野 公式資料・様式 収集指示書

> 作成日: 2026-04-30
> 目的: SSW Compass の `source-index.jsonl` / `forms-catalog.jsonl` / Vertex RAG v2 用に、16分野ごとの公式情報源と第3表・参考様式を補完する。

## 収集ルール

1. **一次情報のみ**: `moj.go.jp`, `mhlw.go.jp`, `mlit.go.jp`, `maff.go.jp`, `meti.go.jp` 等の政府・所管省庁ドメインだけ。
2. **URL は canonical**: 検索結果ページ、クエリ付き URL、PDF viewer URL、SNS redirect URL は不可。
3. **必要な情報**:
   - 分野別トップページ
   - 分野別運用要領 / 分野別運用方針
   - 第3表の公式 Excel/ページ
   - 分野別参考様式
   - 試験・評価試験の公式ページ
   - 協議会加入・誓約書・追加要件の公式ページ
4. **URL が 403/404 になる場合**:
   - 直リンクではなく、上位の安定ページを採用する。
   - `notes` に「direct file URL is blocked/unstable; use landing page」と書く。
5. **形式**: 下記テンプレートに沿って Slack / Markdown / CSV のいずれかで渡してください。

## 収集テンプレート

```markdown
## 分野名
- 分野トップ:
  - title:
  - url:
  - ministry:
- 分野別運用要領:
  - title:
  - url:
  - ministry:
- 第3表 / 提出書類一覧:
  - title:
  - url:
  - file type: html/xlsx/pdf
- 分野別参考様式:
  - title:
  - url:
- 試験・評価試験:
  - title:
  - url:
- 協議会・誓約・追加要件:
  - title:
  - url:
- notes:
```

## 現在のカバレッジ

2026-04-30 更新:

- `data/source-index.jsonl` は canonical URL 重複を整理済み。36 entries / 36 canonical URLs。
- 手動収集 ZIP 由来の分野別「運用要領 / 運用方針」は Vertex AI Search に import 済みだが、安定 URL がないものは `source-index.jsonl` にはまだ直接追加していない。
- `pnpm smoke:search -- --all --strict` で16分野の実検索を確認できる。ただし Discovery Engine の regional search quota に当たりやすいため、必要に応じて `--industries=railway,wood_products --delay-ms=3000` のように分割して実行する。

| 分野 key | 日本語 | source-index OK | failed source | forms-catalog 第3表 | 優先度 | 収集指示 |
|---|---|---:|---:|---:|---|---|
| `nursing_care` | 介護 | 2 | 0 | 0 | 中 | 第3表・介護分野参考様式・介護技能評価/日本語評価の公式ページを追加 |
| `building_cleaning` | ビルクリーニング | 1 | 0 | 0 | 中 | 第3表・ビルクリーニング分野運用要領・試験ページを追加 |
| `industrial_products_manufacturing` | 工業製品製造業 | 0 | 2 | 0 | 高 | METI の最新公式ページ、分野別運用要領、第3表を再収集。既存 URL は timeout failed |
| `construction` | 建設 | 2 | 0 | 1 | 低 | 既存あり。第3表 direct Excel があれば追加 |
| `shipbuilding` | 造船・舶用工業 | 2 | 0 | 0 | 中 | 第3表・分野別運用要領・協議会/試験ページを追加 |
| `automobile_maintenance` | 自動車整備 | 2 | 0 | 0 | 中 | 第3表・自動車整備分野参考様式・試験ページを追加 |
| `aviation` | 航空 | 2 | 0 | 0 | 中 | 第3表・航空分野運用要領・評価試験ページを追加 |
| `accommodation` | 宿泊 | 2 | 0 | 0 | 中 | 第3表・宿泊分野運用要領・宿泊技能測定試験ページを追加 |
| `agriculture` | 農業 | 2 | 1 | 1 | 高 | MAFF SSW agriculture direct page が 403。安定 landing / 協議会 / 派遣関連様式を補完 |
| `fishery` | 漁業 | 0 | 0 | 1 | 高 | 水産庁/MAFF の漁業分野トップ・派遣関連様式・試験ページを追加 |
| `food_manufacturing` | 飲食料品製造業 | 0 | 0 | 0 | 高 | MAFF の飲食料品製造業ページ・第3表・試験ページを追加 |
| `food_service` | 外食業 | 0 | 0 | 0 | 高 | MAFF の外食業ページ・第3表・外食業技能測定試験ページを追加 |
| `automobile_transportation` | 自動車運送業 | 0 | 0 | 0 | 高 | 2024追加分野。MLIT の分野ページ・免許/研修要件・第3表を追加 |
| `railway` | 鉄道 | 0 | 0 | 0 | 高 | 2024追加分野。MLIT の鉄道分野ページ・第3表・試験ページを追加 |
| `forestry` | 林業 | 0 | 0 | 0 | 高 | 2024追加分野。林野庁/MAFF の林業ページ・第3表・試験ページを追加 |
| `wood_products` | 木材産業 | 0 | 0 | 0 | 高 | 2024追加分野。林野庁/MAFF の木材産業ページ・第3表・試験ページを追加 |

## 追加時の `source-index.jsonl` 形式

```json
{
  "id": "mlit-railway-ssw",
  "title": "国土交通省 鉄道分野における特定技能",
  "url": "https://...",
  "canonicalUrl": "https://...",
  "ministry": "mlit",
  "datastore": "visa_legal",
  "dataStoreGroup": "visa_legal_core",
  "trustLevel": "primary_source",
  "sourceType": "official_page",
  "tags": ["ssw_1", "railway"],
  "lang": "ja",
  "verifiedAt": "2026-05-__",
  "contentSha256": "UNVERIFIED",
  "contentMimeType": "text/html",
  "chunkProfile": "native_500_heading",
  "notes": "",
  "status": "ok"
}
```

## 追加時の `forms-catalog.jsonl` 形式

```json
{
  "id": "ssw1-railway-table3",
  "kind": "form_bundle",
  "procedure": "all",
  "sswLevel": "i",
  "section": "table3",
  "industry": "railway",
  "title_ja": "第3表 鉄道分野に関する必要書類 (1号)",
  "officialReferencePage": "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
  "url": "https://...",
  "revisedAt": "2026-05-__",
  "stability": "unstable_content_url",
  "notes": "Excel URL は改定で変動するため安定ページも併記する。"
}
```


# Sprint 2 Summary — Tool 実装 + Vertex DI Seam + Brand Rename

> **Period**: Day 8 – Day 17 (estimated 10 days, actual 10 days)
> **Status**: Complete
> **Author**: 壁 (Sugukuru K.K. CEO/CTO), 2026-04-28 復元
> **Compaction note**: 本書はトランスクリプト圧縮後の復元であり、トランスクリプト原文と照合できなかった箇所は `[reconstructed]` で marking する。コミット履歴・ADR-006〜007 が一次ソースとして優先される。

---

## 0. ゴール

Sprint 2 開始時に設定したゴール:

- [x] **G1**: 4 tools の handler 実装 (Vertex DI seam 経由)、in-memory transport で全テスト pass
- [x] **G2**: 4 UI Resources の実装 (DOMPurify + Trusted Types + a11y + i18n ja/en/id 3言語)
- [x] **G3**: Vertex AI Search の DI seam (`vertex.dispatch`) を確立、fixture mode でローカル動作可能
- [x] **G4**: PII filter (Cloud DLP + regex 二段防御) の skeleton 完成、in-memory テスト pass
- [x] **G5**: ブランド rename を完遂 (SuguVisa Public → Visa Compass Japan → SSW Compass)
- [x] **G6**: ADR-006 (Vertex DI seam) と ADR-007 (brand renaming) 確定
- [⚠️] **G7**: Cloud Run staging 初回 deploy → **Sprint 3 へ繰り越し** (Terraform foundation 整備が想定より重い)

---

## 1. Batch リスト

| # | Batch名 | 期間 | 結果 | 関連 ADR | 概要 |
|---|---|---|---|---|---|
| 1 | Tool handlers 実装 | Day 8-10 | ✅ | — | 4 tools の handler 本実装、scrubInputForPII / vertexSearch / instrumentTool 配線 |
| 2 | UI Resources 実装 | Day 10-12 | ✅ | — | 4 UI Resources の Vite mini-app 化、DOMPurify + a11y + i18n ja/en/id |
| 3 | Vertex DI seam | Day 12-13 | ✅ | ADR-006 | `vertex.dispatch` interface を確立、fixture / Path A (Vertex AI Search) / Path B (Search Lite) を切替可能化 |
| 4 | PII filter skeleton | Day 13-14 | ✅ | — | Cloud DLP API + regex 二段防御の実装、custom infoType `ZAIRYU_CARD_NUMBER` 登録 |
| 5 | Brand rename Phase 1 | Day 14-15 | ✅ | ADR-007 (Phase 1) | SuguVisa Public → Visa Compass Japan (VCJ) リネーム実行 |
| 6 | Brand rename Phase 2 | Day 15-16 | ✅ | ADR-007 (Phase 2) | VCJ → SSW Compass 再リネーム実行 |
| 7 | Test layer 整備 | Day 16-17 | ✅ | — | Vitest in-memory transport + tools/list snapshot + MCP Inspector CLI 4層テスト確立、初期 pass 数 [reconstructed: ~50件] |

---

## 2. Hotfix 集計

Sprint 2 の Hotfix は brand rename 関連が中心。production deploy 前のため staging-level hotfix は production impact ゼロ。

| Bucket | 件数 | 主な原因 | 恒久対策 |
|---|---|---|---|
| brand-rename-residue | 2 | rename 後に古い名称 (SuguVisa, VCJ) が一部 path / env / comment に残留 | grep + sed の sweep を ADR-007 の closing checklist に組み込み |
| zod-schema-drift | 1 | `inputSchema: SchemaName.shape` の渡し方で SDK との互換性 issue | shared-types で `.shape` を re-export する pattern に統一 [reconstructed] |
| vertex-fixture-shape | 1 | fixture data のスキーマが `groundingMetadata` の実構造と乖離 | Path A 移行時に Path B fixture の正規化を ADR-010 で取り扱う方針 |

---

## 3. ADR 起票

- **ADR-006**: Vertex DI seam (Path A / Path B / fixture 切替) — Status: Accepted
  - Vertex AI Search を `vertex.dispatch` 経由で呼び出し、`SSW_VERTEX_MODE` env で fixture / search-lite / search-grounded を切替。テスト時 fixture、staging 時 Path B、production 移行は Sprint 3 (ADR-010 で本実装)
- **ADR-007**: Brand renaming SuguVisa Public → Visa Compass Japan → SSW Compass — Status: Accepted (final: SSW Compass)
  - Phase 1: SuguVisa Public → Visa Compass Japan (VCJ) [行政書士法§19 の「いかなる名目」明文化を踏まえ、Sugukuru の人材紹介事業から完全分離するため独立 SKU 名へ]
  - Phase 2: VCJ → SSW Compass [略称 ssw、日本語通称 SSW コンパス / 特定技能コンパス、ブランド統一]
  - 影響範囲: GCP project ID, GCS bucket, GitHub repo, env var prefix (`SSW_*`), tool description, UI label, marketing copy

---

## 4. メトリクス

| 指標 | 目標 | 実績 | 備考 |
|---|---|---|---|
| 完走日数 | 10 日 | 10 日 | brand rename 2回が想定外コストだったが消化 |
| コミット数 | — | ~80 | [reconstructed] |
| 新規 ADR | 2 | 2 | ADR-006, ADR-007 |
| テスト件数 (新規) | — | ~50 | Vitest in-memory + snapshot + Inspector CLI [reconstructed] |
| Hotfix 件数 | <5 | 4 | 3 bucket、いずれも staging-pre / design-time |
| PR数 / merge率 | — | [reconstructed] | branch protection 設定は Sprint 3 で完了 |

---

## 5. 学び

- **Vertex DI seam の価値が想像以上**: `vertex.dispatch` を通すことで、テスト時 fixture / staging 時 Path B / production 時 Path A という3段階の degradation chain を実装に落とせた。Sprint 3 で staging deploy する際、Vertex 本番接続を後回しにできたのはこの seam のおかげ。Sprint 2 の最大の正解。
- **Brand rename を 2回やった代償**: SuguVisa Public → VCJ → SSW Compass の 2-step rename は、正解として最終確定したものの、env var / GCP resource / repo / domain すべてに rename 影響が走った。**1回で済ませるべきだった** が、行政書士法§19 への対応を Phase で進めた経緯があり、初回 rename 時点で SSW Compass まで踏み切れる確信がなかった。今後は ADR で「rename は最終形まで一気に」を rule 化する。
- **PII filter の Cloud DLP 統合は早めにやって良かった**: regex のみだと日本人氏名や住所のような fuzzy PII を見逃す。Cloud DLP の組み込み infoType (JAPAN_INDIVIDUAL_NUMBER, JAPAN_PASSPORT) と custom infoType (ZAIRYU_CARD_NUMBER) を Sprint 2 で組み込んでおくと、Sprint 3 の DLP 感度調整 (ADR-011) で fail-closed 設計に変えやすかった。
- **UI Resource の 4 言語化は Sprint 4 へ**: Sprint 2 では ja/en/id の 3 言語のみサポート。10カ国語化は Sprint 4 v4 補遺 #1 の core 機能として再設計。Sprint 2 の i18n hook 構造は 10言語化に再利用可能。
- **テスト 4層の効率**: Unit (Vitest in-memory) + Snapshot (tools/list) + Integration (Inspector CLI) + UI E2E の 4層を Sprint 2 で確立。Sprint 3 の CI gating でこの 4層が機能した。Snapshot test は LLM への description sensitivity を CI で gate できる点で特に有効。
- **`vertexSearch` の confidence threshold 0.7 は厳しすぎる場合あり**: 一部の visa category (例: 技能実習関連) では公式情報の更新頻度が低く、grounded chunks が 0 件になるケースがある。Sprint 2 では 0.7 維持で「該当なし → moj.go.jp/isa リダイレクト」の挙動を採用。Sprint 3-4 で feature flag 化を検討。

---

## 6. 次 Sprint への継承事項

- **継承1**: Cloud Run staging 初回 deploy が **Sprint 3 の Day 1-3 で必ず完了** すること。Terraform foundation 構築が想定より重く、Sprint 2 では完遂できなかった。
- **継承2**: Vertex AI Search は **Sprint 3 中盤で Path B (Search Lite) flip** を行う。Path A (Search Grounded) への移行は Sprint 4 以降。
- **継承3**: GCP project ID は `ssw-compass-prod-494613` (project number 397249937286) で確定。GCS state bucket は `gs://ssw-compass-tf-state`。Sprint 3 で Terraform foundation 確立。
- **継承4**: WIF (Workload Identity Federation) を Sprint 3 で確立し、JSON SA キーファイルは廃絶。GitHub Actions OIDC 経由のみ。
- **継承5**: Branch protection を Sprint 3 で確立 (PR + status checks 2 件必須)。`required_approving_review_count` は Sprint 3 中盤に 1 を試行したが、solo 運用期間中は self-merge 効率を優先して 0 に戻し、Sprint 5+ team expansion で再検討する方針。
- **継承6**: PII filter は Sprint 3 で **DLP minLikelihood 感度調整 + sanitizer pattern + fail-closed** に強化。ADR-011 として起票予定 (実際は Sprint 3 では reserved のまま、Sprint 4 で本書き)。
- **継承7**: CSP は Sprint 3 で Report-Only → enforce 移行を試みるが、6-host 互換性の不確定要素のため Sprint 3 末まで Report-Only 維持。
- **未消化 (繰り越し)**: Cloud Armor の Cloud Run 直接 attach は GCP 制約で不可と判明 (Sprint 3 で ADR-012 として記録)、LB 経由の attach は Sprint 4 へ。

---

## 7. 関連ファイル

- `docs/specs/v3-supplement.md` (Sprint 1 末発行、Sprint 2 中も継続参照)
- `docs/adr/ADR-006-vertex-fixture-real-dispatch.md`
- `docs/adr/ADR-007-brand-renaming.md`
- `apps/server/src/tools/{search-visa,classify-procedure,get-deadline-timeline,list-visa-documents}/handler.ts`
- `apps/server/src/vertex/dispatch.ts` (Vertex DI seam)
- `apps/server/src/pii/index.ts` (DLP + regex)
- `ui/{search-visa,procedure-checklist,deadline-timeline,visa-documents}/src/main.tsx`
- `packages/shared-types/src/{tools,resources}/`
- `apps/server/test/{tools,resources,pii}/**`
- `.cursor/rules/{core,pii-guard,mcp-tools,ui-resource,csp-and-schema}.mdc`

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-28 | 初版 (compaction 後の transcript ベース復元) | 壁 |

# Sprint 3 Summary — Infrastructure Buildout + Staging 完成

> **Period**: Day 18 – Day 29 (estimated 17 days, actual 12 days — early completion)
> **Status**: Complete
> **Author**: 壁 (Sugukuru K.K. CEO/CTO), 2026-04-28 確定
> **Compaction note**: 本書はトランスクリプト要約ベースで再構成、Sprint 1/2 と異なり要約に詳細記録があるため `[reconstructed]` マークは限定的。コミット履歴 (74 commits) と ADR-008〜012 が一次ソース。

---

## 0. ゴール

Sprint 3 開始時に設定したゴール:

- [x] **G1**: Terraform foundation を確立 (modules: cloudrun / cloud-armor / service-account / secret-manager / vertex-ai-search / logging)
- [x] **G2**: GCP project (`ssw-compass-prod-494613`) と GCS state bucket (`gs://ssw-compass-tf-state`) 確立
- [x] **G3**: WIF (Workload Identity Federation) で GitHub Actions の SA impersonation 経路確立、JSON SA キー廃絶
- [x] **G4**: BYOSA (`ssw-runtime`, `ssw-deploy`) を least-privilege で構築、4 roles 各
- [x] **G5**: Cloud Run staging (`ssw-mcp-staging`) を IAM-gated + VPC-egress-pinned (NAT 136.110.117.132) で deploy 完了
- [x] **G6**: UI dist 同梱パターン確立 (Vite build 成果物を Docker image に含める)
- [x] **G7**: CSP Report-Only モードで運用、DLP fail-closed sanitizer (ADR-011 reserved)、tests 92/92 pass
- [x] **G8**: VPC + Cloud Armor policy 定義 (Cloud Run 直接 attach は不可と判明、ADR-012)
- [x] **G9**: Branch protection 確立 (status checks 2 件必須、`required_approving_review_count: 0` solo 運用)、direnv `.envrc` 設定
- [x] **G10**: ADR-008〜012 確定
- [⚠️] **G11**: Cloud Run **prod** 初回 deploy は Sprint 4 へ (staging までで Sprint 3 完走)
- [⚠️] **G12**: Custom domain `mcp.ssw-compass.jp` mapping は Sprint 4 へ (ドメイン取得は Sprint 3 で完了)

---

## 1. Batch リスト

| # | Batch名 | 期間 | 結果 | 関連 ADR | 概要 |
|---|---|---|---|---|---|
| 1 | Foundation (project / state / WIF) | Day 18-19 | ✅ | ADR-009 | GCP project 取得、GCS state、WIF pool/provider、direnv `.envrc` |
| 2 | BYOSA + IAM least-privilege | Day 19-20 | ✅ | ADR-009 | `ssw-runtime` (4 roles) と `ssw-deploy` (4 roles) を作成、全部 scoped |
| 3 | Cloud Run staging deploy | Day 20-22 | ✅ | ADR-008 | `process.env` index-access パターン (TS strict 互換)、ssw-mcp-staging IAM-gated 初回 deploy 成功 |
| 4 | Vertex Path B 接続 | Day 22-23 | ✅ | ADR-010 | Vertex AI Search Lite (Path B) 経路確立、staging で `SSW_VERTEX_MODE=fixture` のまま、real flip は Sprint 4 |
| 5 | CSP + DLP + sanitizer 強化 | Day 23-25 | ✅ | ADR-011 (reserved) | CSP Report-Only モード、DLP fail-closed、HTML sanitizer pattern、tests 92/92 pass |
| 6 | VPC + Cloud Armor | Day 25-26 | ✅ | ADR-012 | VPC 構築、Cloud Armor policy `ssw-waf-policy` 定義済み・未 attach (Cloud Run 直接 attach 不可、LB 経由を Sprint 4 で) |
| 7 | UI dist 同梱パターン | Day 26-27 | ✅ | — | Vite build 成果物を Docker image に COPY、ext-apps の `_meta.ui.resourceUri` 経由配信、staging で動作確認 |
| 8 | Closure + Sprint 4 戦略 Deep Research | Day 27-29 | ✅ | — | Sprint 3 retro、ADR 確定、Sprint 4 戦略レポート (Path C×B×C×A) Deep Research 完了、v4 補遺起票準備 |

---

## 2. Hotfix 集計

Sprint 3 では合計 **8件 / 4 buckets** の Hotfix が発生。すべて staging-pre / staging-mid 段階で発見され、production impact ゼロ。

| Bucket | 件数 | 主な原因 | 恒久対策 |
|---|---|---|---|
| **runtime-config-drift** | 3 | `process.env.X` の TypeScript strict 違反 (`noUncheckedIndexedAccess`) | ADR-008 で `process.env["X"]` index-access pattern を確立、Cursor Rules `core.mdc` に追加 |
| **registry-drift** | 1 | Artifact Registry repo 名と CI/CD push 先の食い違い | Terraform で `ssw-images` repo を確定、CI workflow の env を fix |
| **provider-schema-drift** | 2 | `hashicorp/google` provider バージョンを 6.x → 7.0 に上げた際のスキーマ差分 | `~> 7.0` で固定、ADR-009 で Terraform foundation の version pin policy を確立 |
| **app-smoke-mismatch** | 2 | Cloud Run staging deploy 後の smoke test (tools/list) で UI dist が含まれない / 含まれる差分 | UI dist の Docker COPY タイミングを `pnpm build` 後に固定、CI で artifact 整合性チェック追加 |

---

## 3. ADR 起票

- **ADR-008**: `process.env` index-access パターン — Status: Accepted
  - `process.env.SSW_X` ではなく `process.env["SSW_X"]` を必須化。`noUncheckedIndexedAccess` 互換、未定義値は `string | undefined` で型保証
- **ADR-009**: Terraform foundation — Status: Accepted
  - GCS state bucket、WIF pool/provider、SA、Artifact Registry、Cloud Run、Cloud Armor、Vertex AI Search の Terraform module 構造を確立。`hashicorp/google ~> 7.0` で pin
- **ADR-010**: Vertex AI Search Path B (Search Lite) — Status: Accepted
  - Path A (Search Grounded) への移行は ingestion パイプライン整備後とし、Sprint 3-4 は Path B (Search Lite) と fixture を併用。`SSW_VERTEX_MODE=fixture | search-lite | search-grounded` で env 切替
- **ADR-011**: DLP minLikelihood 感度調整 + sanitizer pattern — Status: **Reserved (Sprint 3 では本書き保留)**
  - DLP の minLikelihood と sanitizer の fail-closed 動作を確認、tests 92/92 pass まで到達。Sprint 4 Phase 1 で本書き予定
- **ADR-012**: Egress + Cloud Armor + safeFetch allowlist — Status: Accepted
  - Cloud Run の VPC egress を NAT IP (`136.110.117.132`) で固定、Cloud Armor は LB 経由で attach 必須 (Cloud Run 直接 attach は GCP 制約で不可)、`safeFetch` で `*.go.jp` allowlist を実装

---

## 4. メトリクス

| 指標 | 目標 | 実績 | 備考 |
|---|---|---|---|
| 完走日数 | 17 日 | **12 日** | 5日早期完走 |
| コミット数 | — | **74** | Batch あたり平均 9 commits |
| 新規 ADR | 5 | 5 (008-012) | ADR-011 は reserved |
| テスト件数 (pass) | 80+ | **92/92** | CSP+DLP+sanitizer 強化後 |
| Hotfix 件数 | <10 | 8 | 4 bucket、全 staging-mid 発見 |
| Hotfix bucket 数 | <5 | 4 | runtime-config / registry / provider-schema / app-smoke |
| PR数 / merge率 | — | [reconstructed] | branch protection: status checks 2 件 + `required_approving_review_count: 0` (solo) |
| Cloud Run staging up-time | 100% | 100% | IAM-gated 中の uptime |
| 6-host manual verification | — | **未実施** | Sprint 4 で実施 |

---

## 5. 学び

- **早期完走 (17日見積もり → 12日完走) の理由**: Sprint 2 で確立した Vertex DI seam、PII filter skeleton、UI Resource 4 言語サポートの基盤が、Sprint 3 のインフラ作業に集中する余地を作った。Sprint 1-2 で「設計書を一次ソースとして参照する開発フロー」を確立したため、Cursor が一貫した実装を生成できた点も大きい。
- **Hotfix 8件 / 4 bucket の bucket 化が retro に効いた**: 個別 hotfix を bucket 化 (runtime-config-drift / registry-drift / provider-schema-drift / app-smoke-mismatch) することで、再発防止策を恒久的な ADR / Cursor Rules に落とせた。今後の Sprint でも bucket 化 retro を続ける。
- **Cloud Armor を Cloud Run に直接 attach できない問題**: GCP の制約で、Cloud Armor policy は Cloud Run service に直接 attach できず、HTTPS LB 経由でのみ attach 可能。Sprint 3 末で判明し ADR-012 で記録、Sprint 4 で LB+Custom domain mapping 経路を確立する。事前調査不足だった。
- **WIF + OIDC は本当に楽**: GitHub Actions の secrets に JSON SA キーを置く悪夢から解放された。`google-github-actions/auth@v2` + WIF provider URL のみで authentication が完了。CI/CD の漏洩リスクが構造的に下がった。
- **`process.env` index-access パターン (ADR-008) の連鎖効果**: TypeScript の `noUncheckedIndexedAccess` は厳しいが、ADR-008 で `process.env["X"]` パターンを徹底すると、`undefined` 可能性が型に現れるため、env 設定漏れが local dev と CI で同一に検出される。runtime-config-drift bucket の3件はすべてこのパターン未適用の遺物だった。
- **CSP Report-Only 維持の判断**: enforce 移行は Sprint 4 の 6-host manual verification 完了後に。Report-Only でも CSP report を Cloud Logging に集約しているため、違反検知は機能している。「動かなくする変更を急がない」judgment が正しかった。
- **Sprint 3 戦略 Deep Research を Sprint 末に投入した効果**: Sprint 3 末で Sprint 4 の Deep Research (フリーミアム / HITL / キラー機能 / 派遣業) を実施したことで、Sprint 3 retro と Sprint 4 plan のシームレスな接続ができた。Path C×B×C×A (フリーミアム3-tier、HITL 12項目、キラー機能5、派遣業半完成) を確定。

---

## 6. 次 Sprint への継承事項

Sprint 4 (2026年6-7月、3週間規模) で必須:

- **継承1 (最重要)**: Cloud Run **prod** 初回 deploy。Sprint 3 では staging までで closure、prod は Sprint 4 Phase 0 で実施。`ingress=ALL` + `allow_unauth=false` で OAuth 認証 (ADR-013 起票予定) と組み合わせ。
- **継承2**: Custom domain `mcp.ssw-compass.jp` mapping。Cloudflare DNS は取得済み、Cloud Run custom domain は Sprint 4 Phase 3 で実施。
- **継承3**: Cloud Armor を LB 経由で attach。`ssw-waf-policy` は定義済み・未 attach。LB 構築 + attach は Sprint 4 Phase 3 で完了させる。
- **継承4**: ADR-011 (DLP + sanitizer) を Sprint 4 Phase 1 で本書き。tests 92/92 pass の状態は維持しつつ、minLikelihood の感度を調整 (現在 `LIKELY` → `POSSIBLE` 検討)。
- **継承5**: Vertex Path B (Search Lite) → Path A (Search Grounded) への移行は Sprint 4 Phase 1 (制度変動 fixture を Vertex ingestion に置換するタイミング) で。`SSW_VERTEX_MODE` env で feature flag 切替。
- **継承6**: 6-host manual verification を Sprint 4 で段階実施。最低 Claude Desktop + Web の 2-host で検証、残り (VS Code Copilot / Goose / Postman / MCPJam) は時間と意欲に応じて。
- **継承7**: v4 補遺 (Sprint 4 設計図) は Sprint 3 末で起票完了。Sprint 4 Plan モード Cursor 投入時は `@docs/specs/v4-supplement.md` を一次 Context に。
- **継承8**: Sprint 4 戦略レポート (Path C×B×C×A) を Sprint 4 全 Batch で参照。フリーミアム3-tier、HITL 12項目、キラー機能5つ、派遣業半完成、L0-L4 法的境界線。
- **継承9**: ADR-013〜019 の起票が Sprint 4 中に予告されている (OAuth / HITL / 監査ログ / 制度変動 / 派遣 industry / i18n / 行政書士登録番号)。
- **未消化 (繰り越し)**: Cloud Run prod deploy、Custom domain、Cloud Armor attach、Vertex Path A flip、6-host verification、CSP Report-Only → enforce 移行。すべて Sprint 4 で実施。

Sprint 5 以降の見通し:

- **Sprint 5**: 派遣業フル機能、AI 書類自動入力 (Business)、SSO/SAML/SCIM、API/Webhook、行政書士会連携 OAuth
- **Sprint 6**: OIDC SSO (Business)、Reverse Trial 自動化
- **Sprint 7-10**: 詳細未定、Sprint 4 完了後 retro で確定

---

## 7. 関連ファイル

設計書:

- `docs/specs/v2-comprehensive-design.md`
- `docs/specs/v3-supplement.md`
- `docs/specs/v4-supplement.md` (Sprint 3 末で起票、Sprint 4 で実装)
- `docs/specs/SPEC-INDEX.md`

ADR (Sprint 3 確定分):

- `docs/adr/ADR-008-process-env-index-access.md`
- `docs/adr/ADR-009-terraform-foundation.md`
- `docs/adr/ADR-010-vertex-ingestion-failure-mode.md`
- `docs/adr/ADR-011-dlp-sanitizer-pattern.md` (reserved, Sprint 4 で本書き)
- `docs/adr/ADR-012-egress-and-public-exposure.md`

インフラ:

- `infra/terraform/main.tf`
- `infra/terraform/modules/{cloudrun,cloud-armor,service-account,secret-manager,vertex-ai-search,logging}/`
- `infra/terraform/envs/{prod,staging}/`
- `.github/workflows/ci.yml` (WIF + Cloud Build)
- `.envrc` (direnv)

アプリ:

- `apps/server/Dockerfile` (UI dist 同梱)
- `apps/server/src/{vertex,pii,security,csp}/`
- `apps/server/test/**` (92/92 pass)

GCP リソース:

- Project: `ssw-compass-prod-494613` (project number 397249937286)
- GCS state: `gs://ssw-compass-tf-state`
- SAs: `ssw-runtime@<project>.iam.gserviceaccount.com`, `ssw-deploy@<project>.iam.gserviceaccount.com`
- WIF: `projects/397249937286/locations/global/workloadIdentityPools/ssw-github/providers/ssw-github-oidc`
- Artifact Registry: `asia-northeast1-docker.pkg.dev/ssw-compass-prod-494613/ssw-images`
- Cloud Run staging: `ssw-mcp-staging` (IAM-gated, VPC-egress-pinned)
- Cloud Run prod: 未 deploy (Sprint 4 で初回)
- Cloud Armor: `ssw-waf-policy` (定義済み、未 attach)
- Domain: `ssw-compass.jp` (Cloudflare、Cloud Run custom domain は Sprint 4)

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-28 | 初版 (Sprint 3 完走報告) | 壁 |

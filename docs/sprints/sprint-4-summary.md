# Sprint 4 Summary — フリーミアム × HITL × キラー機能

> **Period**: Day 30 – Day 53 (estimated 21 days, actual ~24 days — 2026-04-28〜29)
> **Status**: Complete (B11 prod deploy 完走、B12 submission packet は Sprint 5 Phase A)
> **Author**: 壁 (Sugukuru K.K. CEO/CTO), 2026-04-29
> **Compaction note**: 本書はエージェントとのリアルタイムセッションからの記録。`[reconstructed]` マークなし。

---

## 0. ゴール達成状況

| Goal | 状態 | 備考 |
|---|---|---|
| G1: v3 既存 92 テスト pass 維持 | ✅ | 232/232 (v4 新規 +140) |
| G2: v4 新規テスト ≥ 30 件 | ✅ | +140 件 (目標大幅超過) |
| G3: 6-host manual verification 最低 2 | 🔜 Sprint 5 | DNS/cert が Sprint 4 末に確定、次 Sprint で実施 |
| G4: ADR-011/013/014/015/017/018/020 確定 | ✅ | 全 7 ADR Accepted |
| G5: キラー機能 #1/2/4/6/8 staging 動作 | ✅ | 全 5 機能 staging + prod で動作確認 |
| G6: prod + LB + Cloud Armor + custom domain + CSP enforce | ✅ | `mcp.ssw-compass.jp` ACTIVE |
| G7: Cloud Logging 24h ERROR < 0.1% | 🔜 | prod 初日、48h 経過後に確認 |
| G8: Submission packet → Sprint 5 Phase A | 📋 | 計画通り defer |

---

## 1. Batch リスト

| # | Batch名 | 期間 | 結果 | 関連 ADR | 概要 |
|---|---|---|---|---|---|
| 1 | Pre-flight (SDK audit + 一次ソース) | Day 1 | ✅ | — | SDK auth API 不在確認 (C1)、SSW_INDUSTRIES_ACTIVE 16分野、法改正施行日確認 |
| 2 | ADR-013 Auth Path Y | Day 2-3 | ✅ | ADR-013 | HS256 JWT middleware、Secret Manager SSW_JWT_SECRET |
| 3 | ADR-014 HITL lockgate | Day 4-5 | ✅ | ADR-014 | HitlControlId (H01-H12)、assertHitlGate、validateToolAnnotations、CaseId nanoid |
| 4 | ADR-011 DLP sanitizer 本書き | Day 6 | ✅ | ADR-011 | minLikelihood POSSIBLE→LIKELY、DLP_CONFIG、DLP_ENABLED=true |
| 5 | Vertex content (parallel-track) | — | 🔜 Sprint 5 | ADR-016 | gyoseishoshi 監修待ち。fixture mode 継続 |
| 6 | ADR-015 Audit log 7年 | Day 7-8 | ✅ | ADR-015 | GCS bucket_lock retention=221184000s、sink_writer IAM |
| 7 | LawUpdate SSOT + fixture | Day 9-10 | ✅ | — | 6 entries (D1/D2/D3/D6 確認済み)、filterActiveLawUpdates |
| 8 | Killer #1 + #8 (10言語 + gantt) | Day 11-13 | ✅ | ADR-018 | SUPPORTED_LANGUAGES 10言語、TierLimitError、SearchVisaInputV4、GetDeadlineTimelineInputV4 |
| 9 | Killer #2 + #4 (law_updates + docs) | Day 14-16 | ✅ | ADR-020 | list_law_updates handler、ListVisaDocumentsInputV4、pdf/csv gating L1→L2 |
| 10 | Killer #6 + #9p (approval + dispatch) | Day 17-19 | ✅ | ADR-017 | submit_gyoseishoshi_approval、validate_zairyu_compatibility、assertDispatchAllowed |
| 11 | prod deploy + LB + Cloud Armor + CSP | Day 20-24 | ✅ | — | mcp.ssw-compass.jp ACTIVE、7 tools prod smoke pass |

---

## 2. Hotfix 集計

Sprint 4 では合計 **8件 / 5 buckets** の Hotfix が発生。

| Bucket | 件数 | 主な原因 | 恒久対策 |
|---|---|---|---|
| **iam-design** | 1 | audit-log module の `logging_writer` IAM が `unique_writer_identity=true` と二重で不要 | sink_writer のみで十分と ADR-015 に明記 |
| **prod-naming** | 1 | staging と prod が同 GCP project でリソース名が衝突 (ssw-vpc, ssw-waf-policy) | prod modules に `-prod` suffix 変数を渡す設計に |
| **docker-build** | 2 | `declare module "express-serve-static-core"` が tsc --build で解決されない / `@google-cloud/logging` が未依存 | AuthedRequest 型エイリアス + fetchAuditEvents を Sprint 5 スタブ化 |
| **smoke-drift** | 1 | tools/list smoke が `== 5` (Sprint 4 で 7 tools に増加) | `>= 5` に変更 |
| **lb-iam** | 1 | prod Cloud Run の `allow_unauthenticated=false` が LB 経由 traffic も拒否 | LB 前提では `true` + Cloud Armor + app-layer JWT で保護 |

---

## 3. ADR 起票

| ADR | タイトル | Status |
|---|---|---|
| **ADR-011** | DLP minLikelihood=LIKELY + sanitizer pattern (Sprint 3 reserved → Accepted) | Accepted |
| **ADR-013** | Auth strategy — Path Y (HS256 JWT) | Accepted |
| **ADR-014** | HITL lockgate + per-call escalation + case_id (nanoid) | Accepted |
| **ADR-015** | Audit log 7年 GCS bucket_lock (Firestore 不採用) | Accepted |
| **ADR-016** | Vertex fixture ↔ ingestion 境界 | Postponed (Sprint 5) |
| **ADR-017** | 派遣業 2 分野限定 (農業・漁業) | Accepted |
| **ADR-018** | 10言語 i18n 段階的 rollout | Accepted |
| **ADR-020** | PDF/CSV gating (legal_level 割り当て) | Accepted |

**Sprint 4 確定 ADR 数: 7**（ADR-016 は Postponed）

---

## 4. メトリクス

| 指標 | Sprint 3 close | **Sprint 4 close** | 備考 |
|---|---:|---:|---|
| main commits | 74 | **114** | +40 |
| vitest tests | 92 | **232** | +140 |
| 新規 ADR (Accepted) | 5 (008-012) | **+7** (011, 013-015, 017-018, 020) | 累計 12 |
| Sprint 4 Hotfix | — | **8** | 5 buckets |
| prod URL | なし | **https://mcp.ssw-compass.jp** | LB + Cloud Armor |
| tools 数 | 4 (v3) | **7+1 internal** (v4) | list_law_updates / submit_approval / validate_zairyu |
| LB static IP | — | **34.149.148.76** | global |
| GCS audit bucket retention | — | **221,184,000 秒 (7年)** | is_locked=true |
| テスト言語数 | 3 (ja/en/id) | **10** | zh-CN/TW/vi/tl/th/km/my 追加 |

---

## 5. 学び

- **Auth layering (LB + Cloud Run + App)**: LB 経由では Cloud Run IAM の `allow_unauthenticated=false` が traffic を全拒否する。LB 前提では application-layer JWT (ADR-013) + Cloud Armor で保護するのが正しい設計。
- **Docker ビルドと module augmentation**: `declare module "express-serve-static-core"` は `tsc --build` composite mode で解決されない。型エイリアス (`AuthedRequest`) パターンに切り替えることで回避。今後の module augmentation は Dockerfile 互換を事前テストすること。
- **GCP project の prod/staging 共用**: 同一 GCP プロジェクトに staging/prod を置く場合、リソース名に env suffix を付ける変数を最初から modules に設計すること。後から追加すると `409 alreadyExists` hotfix が発生する。
- **fetchAuditEvents の SDK 依存管理**: Cloud Logging SDK は `@google-cloud/logging` を別途インストールが必要で、Docker ビルドで TS2307 エラーになった。Sprint 5 機能は stub + NotImplementedError パターンに統一すること。
- **DNS + cert のタイムライン**: お名前.com から Let's Encrypt-like の Google managed cert は DNS 設定後 5〜30 分で ACTIVE になった (今回は約 30 分)。prod deploy の前にアドバンスで DNS 設定を完了させておくとブロッカーがなくなる。
- **Vertex real flip の依存**: gyoseishoshi 監修は URL 死活チェック + 内容承認を含むため sprint 計画上に明示的な「待ち時間」を確保すること。B5 parallel-track の判断は正解だった。

---

## 6. 次 Sprint への継承事項

### Sprint 5 Phase A (Submission packet) — 最優先

- **Submission A1**: Logo 3 variant (monoline SVG, depth-blue `#0A2540`)
- **Submission A2**: Screenshots 6-host (Claude Desktop / Web 最低 2)
- **Submission A3**: Demo video × 3 言語 (ja/en/id, 60s)
- **Submission A4**: Privacy policy trilingual (gyoseishoshi 監修)
- **Submission A5**: License 確定 (Apache-2.0 / MIT / proprietary — ADR 起票)
- **Submission A6**: Anthropic Connectors Directory 提出
- **Submission A7**: OpenAI Apps SDK 提出 (parallel)

### Sprint 5 Phase B (Engineering carry-overs)

- **B5 defer**: Vertex real flip — gyoseishoshi 監修 URL cleanup + ingest + SSW_VERTEX_MODE=real (ADR-016 Postponed)
- **ADR-019**: 行政書士登録番号検証フロー (日行連連携)
- **fetchAuditEvents**: `@google-cloud/logging` 追加 + Cloud Logging read-back 実装
- **G3**: 6-host manual verification (mcp.ssw-compass.jp で Claude Desktop + Web)
- **G7**: Cloud Logging 24h ERROR rate 確認 (prod 初 48h 経過後)
- **Dispatch Sprint 5**: 派遣管理台帳 / 抵触日管理 / マージン率公開
- **Reverse Trial**: ADR-021 起票 + Day 0/7/12/14 状態遷移実装
- **CSP Report-Only 観察**: enforce flip は完了済み、違反 log を 1 週間監視

### Sprint 5 Phase C (Infrastructure)

- Cloudflare DNS 移行 + WAF + Bot Fight Mode + proxied DNS
- Cloud Armor rate limit チューニング (prod 実 traffic 観察後)
- Node.js actions の node20 → node24 移行 (`actions/checkout@v4` 等)
- Prod full `terraform apply` (VPC NAT + vertex_ai_search 有効化確認)

### 未消化 carry-over

- ADR-002 subject drift (sprint-1-summary §3 の記述不整合) — Sprint 5 ADR audit で対処
- UI テスト拡充 (sprint-4-pending §3.11) — ui-bridge DOM tests + CSP snapshot tests
- `SSW_VERTEX_INTEGRATION_TEST=1` opt-in test — Batch 5 着手時に追加

---

## 7. 関連ファイル

設計書:
- `docs/specs/v4-supplement.md` (Sprint 4 設計図)
- `docs/specs/SPEC-INDEX.md`
- `docs/sprints/sprint-4-plan.md` (5 Part 計画)

ADR (Sprint 4 確定分):
- `docs/adr/ADR-011-dlp-sanitizer-pattern.md`
- `docs/adr/ADR-013-auth-strategy.md`
- `docs/adr/ADR-014-hitl-lockgate.md`
- `docs/adr/ADR-015-audit-log-7year-retention.md`
- `docs/adr/ADR-017-dispatch-2-industries.md`
- `docs/adr/ADR-018-i18n-strategy.md`
- `docs/adr/ADR-020-pdf-csv-gating.md`

インフラ:
- `infra/terraform/envs/prod/` (LB + Cloud Armor + audit-log)
- `infra/terraform/modules/lb-https/`
- `infra/terraform/modules/audit-log/`
- `.github/workflows/cd-prod.yml`

アプリ:
- `apps/server/src/auth/` (ADR-013)
- `apps/server/src/hitl/` (ADR-014)
- `apps/server/src/audit/` (ADR-015)
- `apps/server/src/law-updates/` (Batch 7)
- `apps/server/src/tools/{list-law-updates,submit-gyoseishoshi-approval,validate-zairyu-compatibility}/`
- `packages/shared-types/src/{auth,hitl,audit,dispatch,i18n,errors,tools}/`

GCP リソース (prod):
- Cloud Run: `ssw-mcp-prod` (asia-northeast1、`allow_unauthenticated=true`)
- LB: `ssw-prod-backend` / static IP `34.149.148.76`
- SSL cert: `ssw-prod-cert` (mcp.ssw-compass.jp, **ACTIVE**)
- Cloud Armor: `ssw-waf-policy-prod`
- VPC: `ssw-vpc-prod`
- GCS audit: `gs://ssw-compass-audit-7y` (retention=221184000s, locked)
- Secret Manager: `ssw-jwt-secret` (v2 = latest)

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-29 | 初版 (Sprint 4 完走報告) | 壁 |

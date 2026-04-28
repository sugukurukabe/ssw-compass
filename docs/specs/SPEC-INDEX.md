# SSW Compass 設計書 SPEC-INDEX (v4 反映版)

> **本書の役割**: SSW Compass の設計書群の読み順、適用優先順位、変更履歴を記録する。設計書を参照する際は必ず本書から入る。

---

## 設計書の構成 (2026-04-28 時点)

| # | ドキュメント | パス | 範囲 | 状態 |
|---|---|---|---|---|
| 1 | **v2 包括設計** | `docs/specs/v2-comprehensive-design.md` | 全体アーキテクチャ、初期 4 tools / 4 UI Resources、Vertex grounding、PII guard、行政書士法防衛、CI/CD、テスト戦略 | Sprint 1-3 で実装、現役 |
| 2 | **v3 補遺** | `docs/specs/v3-supplement.md` | v2 への補遺。MCP Apps 仕様の正確化、postMessage 完全列挙、Sprint 1-3 で発見された差分 | Sprint 1-3 で実装、現役 |
| 3 | **v4 補遺** | `docs/specs/v4-supplement.md` | Sprint 4 のフリーミアム 3-tier、HITL 12項目、キラー機能5つ、法的境界線 L0-L4、派遣業半完成 | **Sprint 4 で実装、最優先** |
| 4 | **ADR 群** | `docs/adr/ADR-NNN-*.md` | 個別の設計判断記録。ADR-001〜012 が Sprint 1-3 で確定、ADR-013 以降が Sprint 4 で確定予定 | 累積中 |
| 5 | **Sprint Summary** | `docs/sprints/sprint-N-summary.md` | 各 Sprint の完走報告 | Sprint 1-3 確定、Sprint 4 進行中 |

---

## 適用優先順位

矛盾が生じた場合、以下の順で優先する:

```
v4 補遺 > v3 補遺 > v2 設計
ADR-NNN (新しいほど優先) > 設計書本体
Sprint Summary は記録、優先順位判定には使わない
```

特に Sprint 4 進行中は **v4 補遺を最優先**。v2/v3 にある記述で v4 と矛盾するものは v4 が勝つ。

ただし、v4 補遺は v2/v3 を **置換しない**。v4 は「Sprint 4 で追加・拡張する事項」のみを記述しており、v4 にない部分は v2/v3 が引き続き有効である。

---

## v4 で確定した変更

### Tools (v3: 4個 → v4: 7個)

| Tool | v3 | v4 | 変更点 |
|---|---|---|---|
| `search_visa` | ✓ | 拡張 | language 10言語化、response_style 追加 |
| `classify_procedure` | ✓ | 拡張 | legal_level 注釈、hitl_warnings 追加 |
| `get_deadline_timeline` | ✓ | 拡張 | alert_thresholds_days、visualization 追加 |
| `list_visa_documents` | ✓ | 拡張 | output_format (json/html_preview/pdf_draft/csv) 追加 |
| `list_law_updates` | — | **新規** | 制度変更フィード (#2) |
| `submit_gyoseishoshi_approval` | — | **新規** | 行政書士最終承認 + 職印 (#6) |
| `validate_zairyu_compatibility` | — | **新規** | 不法就労判定アラート (H06) |

### UI Resources (v3: 4個 → v4: 6個)

| URI | v3 | v4 | 変更点 |
|---|---|---|---|
| `ui://search-visa/mcp-app.html` | ✓ | 拡張 | 10言語切替 UI |
| `ui://procedure-checklist/mcp-app.html` | ✓ | 拡張 | legal_level バッジ |
| `ui://deadline-timeline/mcp-app.html` | ✓ | 拡張 | SVG ガントチャート |
| `ui://visa-documents/mcp-app.html` | ✓ | 拡張 | PDF/CSV 出力 (Pro 以降) |
| `ui://law-updates/mcp-app.html` | — | **新規** | #2 |
| `ui://draft-approval/mcp-app.html` | — | **新規** | #6 |

### 認証モード

| モード | v3 | v4 |
|---|---|---|
| Anonymous (匿名) | デフォルト | Free tier として継続 |
| OAuth 2.1 + PKCE | — | **Sprint 4 で新規実装** (Pro tier) |
| OIDC SSO | — | Sprint 6 (Business tier) |

### HITL 12項目

H01-H12 のすべてを v4 補遺 2章で定義。Pro 以降で必須実装、Free では UI ロックゲート。詳細は v4 補遺 2.1 / 2.2 / 2.3 を参照。

### 法的境界線 L0-L4

- L0: 一般情報提供 (Free)
- L1: 一般テンプレ提供 (Free)
- L2: 質問→自動入力 (Pro 行政書士認証下)
- L3: 個別カスタマイズ生成 (Pro 行政書士認証下)
- L4: 完全代行 (永久禁止、実装しない)

詳細は v4 補遺 4章。

### 派遣業対応

- 派遣可能分野は **農業・漁業の2分野のみ** (タスク文の「4分野」は誤り、v4 で訂正)
- Sprint 4 で派遣計画書 (1-12号) / 派遣先概要書 (1-14号 農業, 1-15号 漁業) HTML/CSS 再現
- 派遣管理台帳・抵触日管理・マージン率公開は Sprint 5 へ送る

詳細は v4 補遺 5章。

---

## 変更履歴

| 日付 | バージョン | 変更点 | 起票 |
|---|---|---|---|
| 2026-04-27 | v2 初版 | 包括設計書発行 | 壁 |
| 2026-04-27 | v3 補遺 | v2 への補遺、MCP Apps 仕様正確化 | 壁 |
| 2026-04-27 | SPEC-INDEX v1 | 設計書索引初版 | 壁 |
| 2026-04-28 | **v4 補遺** | **Sprint 4 フリーミアム 3-tier、HITL 12項目、キラー機能5つ、L0-L4 境界線、派遣業半完成** | **壁 + 戦略レポート反映** |
| 2026-04-28 | SPEC-INDEX v2 | v4 反映、優先順位ルール明示 | 壁 |

---

## 設計書を読む順序

### 新規参加者

1. SPEC-INDEX (本書) を読む
2. v4 補遺の **0章** を読む (現状の Sprint 4 重点)
3. v2 設計を 0-3章まで読む (アーキテクチャ全体像)
4. v3 補遺を読む (v2 への差分)
5. v4 補遺の残り全章を読む
6. ADR-001〜最新まで読む
7. Sprint Summary を Sprint 1 から読む

### Sprint 4 実装担当 (Cursor)

1. SPEC-INDEX (本書)
2. v4 補遺 全章
3. v3 補遺の該当章 (実装する tool/UI Resource に対応する箇所)
4. ADR-006 (Vertex DI seam), ADR-008-012 (Sprint 3 確定事項)
5. Sprint 3 Summary
6. `prompts/sprint-4-planning.md` (Cursor 向け実装計画依頼)

### 法務・行政書士監修者

1. v4 補遺 2章 (HITL 12項目)
2. v4 補遺 4章 (法的境界線 L0-L4)
3. v4 補遺 6章 (制度変動カレンダー)
4. v2 設計 11章 (行政書士法防衛)
5. ADR-007 (brand renaming) — 「行政書士法 §1-2/§1-3」「§19」関連の確認
6. Privacy Policy ドラフト (Sprint 4 Phase 3 で行政書士監修)

### Connectors Directory 提出担当

1. v4 補遺 0章 (Sprint 4 ゴール)
2. v2 設計 14章 (ディレクトリ提出戦略)
3. ADR-007 (brand renaming) — マーケティングコピー
4. Sprint 4 Phase 3 提出 packet (logo / screenshots / demo video / privacy policy)

---

## 設計書の改訂ルール

1. **v2/v3 は原則改訂しない**。Sprint 4 以降の変更は v4 補遺以降に書く。
2. **v4 補遺の interface freeze は変更不可**。変更が必要な場合は v5 補遺を起こす。
3. **ADR は append-only**。既存 ADR の status 変更 (Proposed → Accepted → Superseded) のみ可。
4. **本 SPEC-INDEX は実装担当が変更しない**。設計判断 (新 v 番号の補遺起こし、ADR 起票) と同期して人間が更新する。
5. すべての変更は PR レビュー必須 (status checks 2 件: CI Lint+typecheck+test / Terraform fmt+validate)。solo 運用期間中は `required_approving_review_count: 0`、Sprint 5+ の team expansion 時に self-approval 防止を再検討する (sprint-3-summary.md §6 継承事項参照)。

---

**以上。Sprint 4 着手時はまず v4 補遺 0章 → v4 補遺 1-11章 → ADR-013 以降の予告 (v4 補遺 9章) を読むこと。**

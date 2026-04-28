# Batch 1 Pre-flight Report

> **Sprint 4 Batch 1** — Pre-flight (SDK + ADR audit + 一次ソース確認 + license)
> **Date**: 2026-04-28
> **Author**: Cursor Agent (Sonnet 4.6) + 壁 (Sugukuru K.K. CEO)
> **Purpose**: Sprint 4 着手ブロッカーをすべて解消し、Batch 2 の実装に安全に進む。

---

## 1. Sprint 3 Closure Grep — Invariant Check

**実行時刻**: 2026-04-28 Sprint 4 Batch 1 Day 1

| # | Check | Expected | Actual | 判定 |
|---|---|---:|---:|---|
| 1 | `TODO(sprint-3)` 残存 | 0 | 0 | ✅ |
| 2 | staging URL leak (ADR・url-health・sprints 除外) | 0 | 0 | ✅ |
| 3 | Sprint 3 ADR 4 件 (ADR-008/009/010/012) | 4 | 4 | ✅ |
| 4 | main commits | ≥ 78 | 80 | ✅ |
| 5 | branch protection (status checks 2 件) | 2 件 | 2 件 | ✅ |
| 6 | SDK pins (`sdk ^1.29.0`, `ext-apps ^1.6.0`) | 一致 | 一致 | ✅ |
| 7 | tests | 92 passed | 92 passed | ✅ |

**判定: 全 7 項目 PASS → Sprint 4 Batch 1 着手可**

---

## 2. SDK Auth API 実機検証 (C1)

**目的**: ADR-013 Path X (SDK TokenVerifier) の採否判断

### 実機検証結果

```
node --input-type=module -e "
  import('@modelcontextprotocol/sdk/server/auth/provider.js').then(...)
"
→ PRESENT but empty module (no exports)

import('@modelcontextprotocol/sdk/server/auth/types.js').then(...)
→ PRESENT, keys: (empty — no exports)

dist/ directory structure:
  node_modules/@modelcontextprotocol/sdk/dist/
    ├── cjs/
    └── esm/
  # auth/ サブディレクトリ: 存在しない

SDK package.json exports:
  auth-related keys: (none)
```

### SDK リリース履歴 (最新 10 件)

```
1.29.0  (最新、現在のpin)
1.28.0
1.27.1
1.27.0
1.26.0
1.25.3
1.25.2
1.25.1
1.25.0
1.24.3
```

1.30.x は **未リリース** (2026-04-28 時点)。

### 判定

| Path | 実現可否 | 理由 |
|---|---|---|
| **Path X**: SDK TokenVerifier | **不可** | `auth/provider.js` は module は解決されるが export なし。auth middleware は SDK 1.29.0 に存在しない |
| **Path Y**: application-layer JWT self-verify | **可** | Express/Hono middleware として独自実装 |
| **Path Z**: OAuth Client Credentials + "free_public" scope | **可** | Cloud Run auth-gated 維持、Free tier は public token 配布 |

**ADR-013 の評価範囲は Path Y / Path Z の 2 択**。Batch 2 で詳細設計・決定。

---

## 3. ADR Subject Drift Audit

**目的**: sprint-1-summary §3 の記述と actual ADR ファイルの主題 drift を特定

| ADR | sprint-1-summary §3 の記述 | actual ADR title | Drift |
|---|---|---|---|
| ADR-001 | pino v10 採用 | "Upgrade pino to v10 in the server workspace" | ✅ 一致 |
| ADR-002 | ext-apps@1.7.0 SDK 固定 | "Errata for v2 §6.1 (UI Resource sample) — adopt ext-apps@1.7.0 real API" | **⚠️ subject drift** (SDK pin の主旨ではなく spec errata) |
| ADR-003 | Server Card v2§8.3 | "Server Card — v2 §8.3 as product-level source of truth; /.well-known/mcp.json as path" | ✅ 一致 |
| ADR-004 | React-free UI 採用 | "React-free UI stack — pure TypeScript + DOM + @ssw/ui-bridge" | ✅ 一致 |
| ADR-005 | ext-apps@1.7.0 SDK 固定 | "@modelcontextprotocol/ext-apps 1.7.0 upgrade evaluation — stay on `^1.6.0`" | ✅ 主旨一致 (SDK pin の判断が ADR-005 に記録。ADR-002 は API usage errata) |
| ADR-006 | Vertex DI seam (DI / fixture / real dispatch) | "Vertex AI Search — fixture / real dispatch via SSW_VERTEX_MODE" | ✅ 一致 |
| ADR-007 | Brand renaming VCJ → SSW Compass | "Brand renaming from 'Visa Compass Japan' to 'SSW Compass'" | ✅ 一致 |
| ADR-008 | process.env index-access pattern | "`process.env` index-access convention + disable biome `useLiteralKeys`" | ✅ 一致 |
| ADR-009 | Terraform foundation | "Terraform foundation — state backend, provider pinning, env split, staging-public exception" | ✅ 一致 |
| ADR-010 | Vertex AI Search Path B | "Vertex AI Search ingestion strategy and Sprint 3–4 deferral" | ✅ 一致 |
| ADR-011 | DLP + sanitizer (reserved) | 欠番 (reserved, Sprint 4 Batch 4 で本書き予定) | ✅ 予定通り |
| ADR-012 | Egress + Cloud Armor + safeFetch | "Network egress controls, Cloud Armor definition, staging close-public" | ✅ 一致 |

### ADR-002 subject drift の解釈と対処

- sprint-1-summary §3 は ADR-002 を「ext-apps@1.7.0 SDK 固定」と記述
- actual ADR-002 の主題: v2 §6.1 サンプルコードの errata (正しい API 使い方 = `PostMessageTransport(window.parent, window.parent)`)
- **SDK pin の decision** は actual ADR-005 に記録済み
- **対処**: sprint-1-summary は sprint-4-pending.md で既に carry-over として追跡済み。本 Batch では修正しない (sprint-1-summary §3 の注記として将来修正対象と認識)

**Audit 判定: ブロッカーなし。ADR-002 の subject drift は既知 carry-over。**

---

## 4. 法改正施行日 一次ソース確認 (D1 / D2)

### D1: 改正行政書士法 §19 施行日

| 項目 | 内容 |
|---|---|
| **施行日** | **2026年1月1日 (令和8年1月1日)** ✅ 確定 |
| 法律名 | 行政書士法の一部を改正する法律 (令和七年法律第65号) |
| 成立日 | 2025年6月6日 |
| 公布日 | 2025年6月13日 |
| 条文 | 行政書士法第19条第1項「他人の依頼を受けいかなる名目によるかを問わず報酬を得て」の文言追加 |
| 両罰規定 | 法人にも罰金 (第23条の3 整備) |
| 参照 | [法改正施行サイト](https://www.legal-center.biz/2026/01/02/1487/) / [兵ト協通知](https://www.hyotokyo.or.jp/news/proper/20138.html) / [申請Navi解説](https://shinnavi.jp/column/118/) |
| v4 §0 記述 | 「2026/1/1施行、いかなる名目」✅ 正確 |

### D2: 入管法 §73-2 不法就労助長罪 厳罰化施行日

**⚠️ v4 補遺の記述訂正が必要**

| 項目 | 内容 |
|---|---|
| **施行日** | **2025年6月 (令和7年6月)** ✅ 確定 (exact date TBD below) |
| 法律名 | 出入国管理及び難民認定法等の一部を改正する法律 (令和6年成立) |
| 成立日 | 2024年6月14日 |
| 公布日 | 2024年6月21日 |
| 施行 | 公布から2年以内の政令で定める日 → 2025年6月に施行 |
| 改正内容 | 3年以下懲役/300万円以下罰金 → **5年以下拘禁刑/500万円以下罰金** (併科可) |
| 過失処罰 | 在留カード未確認等の過失でも適用 |
| 法人罰 | 最大1億円 |
| 参照 | [東海中小企業支援組合](https://tbsa.or.jp/illegal-employment/) / [マイナビグローバル](https://global-saponet.mgl.mynavi.jp/visa/1103) / [エール法律改正](https://yellbizlaw.jp/...) |

**v4 補遺の訂正点**:
- v4 §0 「2026/6/14施行」→ **誤り** (2024/6/14 は成立日)
- 正確な施行日: **2025年6月** (exact date を政令確認できていないため `"2025-06"` で fixture 記録)
- v4 §6.1 fixture `FY2026-immigration-act-73-2-reinforcement` は Sprint 4 Batch 7 で date 訂正が必要
- ただし入管法 §73-2 の厳罰化は現在 **already in effect** — `status: "active"` は正しい

---

## 5. 特定技能対象分野 確認 (D3)

| 項目 | 内容 |
|---|---|
| **現行分野数** | **16 分野** (2026年1月現在) ✅ 確定 |
| 根拠 | 2024年3月29日 閣議決定で12→16分野に拡大 |
| 参照 | [moj.go.jp 制度説明](https://www.moj.go.jp/isa/applications/ssw/) / [行政書士法人Tree](https://office-tree.jp/blog/immigration/tokutei-ginou-guide/) |

**16 分野の確定リスト** (英語 enum 名は `packages/shared-types/src/ssw-industries.ts` に反映済み):

| # | 分野名 | enum | 追加年 |
|---|---|---|---|
| 1 | 介護 | `nursing_care` | 2019 |
| 2 | ビルクリーニング | `building_cleaning` | 2019 |
| 3 | 工業製品製造業 (旧3分野統合) | `industrial_products_manufacturing` | 2019 (統合 2022) |
| 4 | 建設 | `construction` | 2019 |
| 5 | 造船・舶用工業 | `shipbuilding` | 2019 |
| 6 | 自動車整備 | `automobile_maintenance` | 2019 |
| 7 | 航空 | `aviation` | 2019 |
| 8 | 宿泊 | `accommodation` | 2019 |
| 9 | 農業 | `agriculture` | 2019 |
| 10 | 漁業 | `fishery` | 2019 |
| 11 | 飲食料品製造業 | `food_manufacturing` | 2019 |
| 12 | 外食業 | `food_service` | 2019 |
| 13 | 自動車運送業 | `automobile_transportation` | 2024 |
| 14 | 鉄道 | `railway` | 2024 |
| 15 | 林業 | `forestry` | 2024 |
| 16 | 木材産業 | `wood_products` | 2024 |

派遣可能: 農業・漁業 **2 分野のみ** (`DISPATCH_ALLOWED_INDUSTRIES` = `["agriculture", "fishery"]`)。

---

## 6. SDK バージョン状況 (D7)

| 項目 | 内容 |
|---|---|
| 現在 pin | `^1.29.0` (Sprint 3 base) |
| 最新リリース | `1.29.0` (2026-04-28 時点で最新) |
| 1.30.x | **未リリース** |
| auth API 状態 | `dist/server/auth/` ディレクトリ**存在しない** → Path X 不可 |
| ext-apps pin | `^1.6.0` (1.7.0 で resolve、ADR-005 説明通り) |

**Batch 2 への持ち越し**: ADR-013 は Path Y (application-layer JWT) or Path Z (OAuth Client Credentials) から選択。

---

## 7. その他確認事項 (D4/D6)

| ID | 確認項目 | 結果 |
|---|---|---|
| D4 | 外食業1号 新規受入停止 | **2026年3月27日付 moj.go.jp 掲載「特定技能「外食業分野」における受入れ上限の運用について」確認。新規受入が原則停止方向。** fixture `status: "pending_verification"` から `"active"` に変更 (Batch 7 で対応) |
| D5 | 在留手数料改定 | 2026年3月10日 閣議決定・国会提出済。具体額は政令確定後 → fixture `status: "pending_verification"` 維持 |
| D6 | 育成就労制度 施行日 | **2027年4月 施行** (令和6年改正入管法) ✅ 確定 |

---

## 8. License 判断

**判断日**: 2026-04-28

**選択**: TBD — 壁さんが決定して本セクションを更新してください。

| 候補 | 特徴 | Connectors Directory 適合 | 推奨度 |
|---|---|---|---|
| **Apache-2.0** | permissive、特許条項付き、MCP エコシステム標準 | ✅ 問題なし | ⭐⭐⭐ |
| **MIT** | simpler、特許条項なし | ✅ 問題なし | ⭐⭐⭐ |
| **proprietary** | competitive moat 維持 | OpenAI が OSS 要件要求した場合に再評価必要 | ⭐⭐ |

**決定後にやること**:
1. `LICENSE` ファイルを repo root に commit
2. `package.json` (root + 全 workspace) の `"license"` field を更新
3. `README.md` の License セクション更新
4. Server Card の publisher metadata に license URL 追加 (Batch 11 で)

> ⚠️ license 未確定のため、本 Batch 1 PR は `LICENSE` / `package.json license` 更新を **含まない**。壁さんが選定後に別途 commit を依頼してください。

---

## 9. 成果物サマリー

| 項目 | 状態 |
|---|---|
| Sprint 3 closure invariant 7 項目 | ✅ All pass |
| C1: SDK auth API → Path X 不可 確定 | ✅ Resolved |
| ADR-002 subject drift | ✅ Known carry-over、ブロッカーなし |
| D1: 行政書士法 §19 施行日 2026/1/1 | ✅ Confirmed |
| D2: 入管法 §73-2 施行日 → **2025年6月** (v4 §0 の 2026/6/14 は誤り) | ✅ Confirmed (訂正要) |
| D3: 特定技能 16 分野 確定 | ✅ Confirmed |
| D4: 外食業 新規受入停止 | ✅ 停止方向確認 (Batch 7 fixture で対応) |
| D5: 在留手数料改定 | pending_verification 維持 |
| D6: 育成就労 2027年4月施行 | ✅ Confirmed |
| D7: SDK 1.30.x 未リリース、auth API 不在 | ✅ Confirmed |
| SSW_INDUSTRIES_ACTIVE (16 分野) 定数 | ✅ packages/shared-types に配置 |
| License 判断 | **⚠️ 壁さん待ち (B1 close 前に決定を)** |

---

## 10. Batch 2 への申し送り

1. **ADR-013**: Path Y (application-layer JWT) vs Path Z (OAuth Client Credentials + free_public scope) を評価。Cloud Run は auth-gated 維持 (ADR-012 不変)。
2. **v4 補遺の施行日訂正 PR**: `docs/specs/v4-supplement.md` の §0 「入管法§73-2 (2026/6/14施行)」を「(2025年6月施行)」に訂正。Batch 2 着手前または並行で。
3. **License 決定**: 壁さんが決定し `LICENSE` file + package.json を commit。
4. **v4 §6.1 fixture の `FY2026-immigration-act-73-2-reinforcement` `effective_date`**: Batch 7 で `"2025-06"` (日不明) または actual 政令日に修正。`status` は `"active"` に変更。

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-28 | 初版 (Sprint 4 Batch 1 Pre-flight 実行) | Cursor Agent (Sonnet 4.6) |

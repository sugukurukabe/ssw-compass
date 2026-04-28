# Sprint 1 Summary — Design 確定 + Monorepo Bootstrap

> **Period**: Day 1 – Day 7 (estimated 7 days, actual 7 days)
> **Status**: Complete
> **Author**: 壁 (Sugukuru K.K. CEO/CTO), 2026-04-28 復元
> **Compaction note**: 本書はトランスクリプト圧縮後の復元であり、トランスクリプト原文と照合できなかった箇所は `[reconstructed]` で marking する。コミット履歴・ADR-001〜005 が一次ソースとして優先される。

---

## 0. ゴール

Sprint 1 開始時に設定したゴール:

- [x] **G1**: 設計書 v2 (Comprehensive Research + Sprint 1 Ready Reference) を Deep Research で確定
- [x] **G2**: ブランド名・GCP プロジェクト名・GitHub repo の方針を確定 (当初は SuguVisa Public)
- [x] **G3**: monorepo 構造 (pnpm workspaces + Turborepo) 初期化、コンパイル可能状態
- [x] **G4**: 4 tools (search_visa / classify_procedure / get_deadline_timeline / list_visa_documents) と 4 UI Resources の skeleton 実装
- [x] **G5**: Vertex AI Search の DI seam 設計 (実装は Sprint 2-3 で fixture mode)
- [x] **G6**: ADR-001〜005 確定

---

## 1. Batch リスト

| # | Batch名 | 期間 | 結果 | 関連 ADR | 概要 |
|---|---|---|---|---|---|
| 1 | Design Deep Research | Day 1-2 | ✅ | — | v2 設計書 (Comprehensive Research) 生成 |
| 2 | Monorepo bootstrap | Day 2-3 | ✅ | ADR-001 | pnpm + Turborepo + Biome v2.4 + tsconfig.base 構成 |
| 3 | SDK ピン + 依存確定 | Day 3 | ✅ | ADR-002 | @modelcontextprotocol/sdk^1.29.0 + ext-apps^1.7.0 + zod^3.23 |
| 4 | Server Card v2§8.3 | Day 3-4 | ✅ | ADR-003 | tool annotations / disclaimer / dual-key (`openai/outputTemplate`) パターン確定 |
| 5 | UI Resource 方針 | Day 4-5 | ✅ | ADR-004 | React-free UI 採用、Vite + viteSingleFile + DOMPurify + Trusted Types |
| 6 | 4 tools + 4 UIs skeleton | Day 5-6 | ✅ | ADR-005 | `search_visa` / `classify_procedure` / `get_deadline_timeline` / `list_visa_documents` の interface 確定 |
| 7 | v3 補遺起票 | Day 6-7 | ✅ | — | v2 設計書発行後に発見された差分 (postMessage 仕様、SSE 廃止、SDK バージョン) を v3 補遺で固定 |

---

## 2. Hotfix 集計

Sprint 1 は設計と skeleton 実装が中心で、production hotfix は発生せず。design issue を v3 補遺として迅速に統合した。

| Bucket | 件数 | 主な原因 | 恒久対策 |
|---|---|---|---|
| design-spec-drift | 1 | postMessage 仕様の `ui/init` 系記述が誤り (実際は `ui/initialize` 系) | v3 補遺で正規化、ADR-003 で確定 [reconstructed] |
| sdk-version-drift | 1 | Zod v4 が SDK 互換性を破壊する未解決 issue を発見 | zod ^3.23.x で固定、ADR-002 で記録 |

---

## 3. ADR 起票

- **ADR-001**: pino v10 採用 — Status: Accepted
  - 採用理由: GCP pino-logging-gcp-config と互換、redact 機能で PII 漏洩防止
- **ADR-002**: ext-apps@1.7.0 SDK 固定 — Status: Accepted
  - SDK は `^1.29.0`、ext-apps は `^1.7.0`、zod は `^3.23.x` (v4 不可) で workspace pin
- **ADR-003**: Server Card v2§8.3 (tool annotations 標準) — Status: Accepted
  - 全 tool に `readOnlyHint`, `destructiveHint`, `openWorldHint`, `title` を必須、`_meta.ui.resourceUri` (nested) と `openai/outputTemplate` の dual-key
- **ADR-004**: React-free UI 採用 — Status: Accepted
  - viteSingleFile + DOMPurify + 素の TypeScript + Trusted Types。React 不採用の理由は bundle size budget (512KB 上限) と CSP hash 計算簡素化
- **ADR-005**: ext-apps 1.7.0 採用 (App class API 確定) — Status: Accepted
  - `App` / `PostMessageTransport` / `applyDocumentTheme` / `applyHostStyleVariables` / `applyHostFonts` を core API として固定 [reconstructed: ADR-002 と内容重複の可能性あり、原文確認推奨]

---

## 4. メトリクス

| 指標 | 目標 | 実績 | 備考 |
|---|---|---|---|
| 完走日数 | 7 日 | 7 日 | 設計 fast track |
| コミット数 | — | ~30 | [reconstructed] |
| 新規 ADR | 5 | 5 | ADR-001〜005 |
| テスト件数 (新規) | — | 0 | Sprint 1 は skeleton のみ、テスト本格化は Sprint 2 |
| Hotfix 件数 | 0 | 0 | bucket 2 は design-time 修正、production hotfix ではない |
| PR数 / merge率 | — | [reconstructed] | branch protection 確立は Sprint 3 で完了 |

---

## 5. 学び

- **Deep Research 投入の価値**: v2 設計書を最初に Deep Research で確定したため、Sprint 1 中盤以降は「設計書 5章を見て tool 実装」「7章を見て PII guard」というように **設計を一次ソースとして参照する開発フロー** が定着した。Cursor も設計書を Context に置けば一貫した実装を生成する。
- **MCP Apps 仕様の流動性**: SEP-1865 (2026-01-26 stable) であっても、postMessage プロトコル名 (`ui/init` vs `ui/initialize`) など仕様詳細は文献ごとに differ する。**Deep Research 直後に v3 補遺で正規化する判断が正しかった** — もし Sprint 2 まで放置していたら hotfix が大量発生していた。
- **Zod v4 は要警戒**: SDK ≤1.17.5 と Zod v4 の組み合わせは `_parse`/`_def` 廃止で破綻する。Zod v3.23.x で固定する判断は workspace 全体に effective。
- **設計書が長文すぎる問題**: v2 が 829 行、v3 補遺がさらに数百行となり、Cursor の context window を圧迫する懸念。SPEC-INDEX を起こして優先順位を明確にする方針は Sprint 1 末で決定 (実体は Sprint 2 で作成)。
- **ブランド名は決定保留が正解**: Sprint 1 開始時は「SuguVisa Public」だったが、行政書士法§19 の「いかなる名目」明文化を踏まえ Sugukuru の有償人材紹介事業からの完全分離が必要 → 別 SKU 名 (Visa Compass Japan → SSW Compass) への rename を Sprint 2 で実施。Sprint 1 で固定しなかったため rename コストが小さく済んだ。
- **6-host テストの遠さ**: Sprint 1 では Cursor + ローカル MCP Inspector のみで開発。実際の Claude Desktop / Web 接続テストは Sprint 3 staging deploy 後でないと実施不可と確認。

---

## 6. 次 Sprint への継承事項

- **継承1**: v2/v3 設計書を一次ソースとして全実装が参照する。Cursor Plan / Composer モードでの実装時は必ず `@docs/specs/` を Context に追加。
- **継承2**: Vertex AI Search は Sprint 2 で **DI seam を確立** (実体は fixture or stub) し、Sprint 3 で Path B (real flip) するロードマップ。Sprint 2 ではコードベースに Vertex client を直接 import しない (テスト不能化を防ぐため)。
- **継承3**: ブランド名は **Sprint 2 で SuguVisa Public → Visa Compass Japan (VCJ) に rename**、Sprint 2 末でさらに **VCJ → SSW Compass** に再 rename される予定。GCP プロジェクト ID / GCS bucket 名 / GitHub repo すべて影響。
- **継承4**: Sprint 1 では production deploy なし。Cloud Run staging 構築は Sprint 3。Terraform foundation 起票も Sprint 3 で ADR-009 として確定。
- **継承5**: Sprint 1 で v3 補遺を起こしたため、Sprint 2 開始時の design 状態は v2 + v3 補遺の混合。Sprint 2 の Plan モードでは v2 と v3 の差分を整理しながら進めること。
- **未消化 (繰り越し)**: 認証フロー (現状 anonymous public のみ)。Pro tier 導入は Sprint 4 (v4 補遺) まで先送り。

---

## 7. 関連ファイル

- `docs/specs/v2-comprehensive-design.md` (Sprint 1 中盤で発行、829 行)
- `docs/specs/v3-supplement.md` (Sprint 1 末で発行、v2 への差分)
- `docs/adr/ADR-001-pino-v10-upgrade.md`
- `docs/adr/ADR-002-v2-section-6-1-spec-errata.md`
- `docs/adr/ADR-003-server-card-spec-source-of-truth.md`
- `docs/adr/ADR-004-react-free-ui-stack.md`
- `docs/adr/ADR-005-ext-apps-1-7-0-evaluation.md`
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- `apps/server/src/tools/{search-visa,classify-procedure,get-deadline-timeline,list-visa-documents}/`
- `ui/{search-visa,procedure-checklist,deadline-timeline,visa-documents}/`
- `packages/shared-types/src/`

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-28 | 初版 (compaction 後の transcript ベース復元) | 壁 |

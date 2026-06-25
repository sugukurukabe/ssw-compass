# AGENTS.md — SSW Compass エージェント運用ガイド

> 正本（このファイルがリポジトリルートの単一の正本）。
> Canonical agent guide (single source of truth at repo root).
> 詳細な強制ルールは `.cursor/rules/*.mdc` を参照。本書はその要約と運用上の境界を示す。

SSW Compass（SSW）は、日本の特定技能（SSW）ビザ手続きに関する公的・読み取り中心・
匿名の MCP アプリです。出入国在留管理庁などの一次情報のみを根拠にし、法律行為は行いません。

---

## 1. ツール一覧（実態：9 ツール）

実装は `apps/server/src/tools/<tool>/index.ts`（定義・アノテーション）と
`apps/server/src/tools/<tool>/handler.ts`（実行）に分離。全 9 ツールが `outputSchema` を
宣言し `structuredContent` を返す（構造化出力は実装済み。テキストは後方互換フォールバック）。

### 読み取り専用 6 ツール（匿名・無料・L0/L1）

| ツール | 役割 |
| --- | --- |
| `search_visa` | 一次情報源から特定技能・関連手続きを検索 |
| `classify_procedure` | 現在資格・希望資格・所在地から必要な申請種別を判定 |
| `get_deadline_timeline` | 法定期限タイムライン（14日以内届出・定期届出・更新・通算5年上限等） |
| `list_visa_documents` | 申請区分・分野別の必要書類リスト（省略条件適用） |
| `validate_zairyu_compatibility` | 在留資格と就労の適合性判定（不法就労アラート H06） |
| `list_law_updates` | 入管法・手数料・様式改正の制度変動フィード |

### Pro tier 3 ツール（OAuth scope + HITL ゲート・L2、ADR-024）

| ツール | 役割 | スコープ |
| --- | --- | --- |
| `prepare_document_package` | 書類パッケージ生成 + GCS 署名 URL（冪等・CAS） | `compass:draft` |
| `submit_gyoseishoshi_approval` | 行政書士承認の記録（MRTR 多段承認・監査 7年保存） | `compass:approve` |
| `get_package_status` | パッケージ状態照会・完了時は新署名 URL 再発行 | `compass:draft` |

---

## 2. アノテーション規約（実態）

起動時に `validateToolAnnotations`（`apps/server/src/server.ts`）が整合性を検証する。

- 読み取り専用 6 ツール：`readOnlyHint: true` / `destructiveHint: false`。
- `submit_gyoseishoshi_approval` と `prepare_document_package`：`readOnlyHint: false`
  （書き込み系。ただし `destructiveHint: false`。ADR-024 で承認された唯一の書き込み系ツール）。
- `get_package_status`：`readOnlyHint: true`（状態照会のみ。署名 URL 再発行は副作用なしの読み取り扱い）。
- 全ツールに `title` を付与。

---

## 3. プロトコル方針（デュアル構成・実態）

RC 機能（`server/discover`・ルーティングヘッダ・MRTR・Server Card のデュアル広告）は
**実装・本番デプロイ済み**。本サーバーはデュアル構成を採る。

- **既定申告は安定版 `2025-11-25`。** Server Card は `protocolVersions: ["2025-11-25","2026-07-28"]`
  を広告（`apps/server/src/server-card.ts`）。
- `initialize` ネゴシエーションで **RC 非対応クライアントには `2025-11-25` へフォールバック**する。
- RC `2026-07-28` 機能は RC 対応クライアントへの**後方互換の上乗せ**として提供。
- **RC 既定切り替えは安定版（2026-07-28）公開後に人間が判断**する。それまでは既定を 2025-11-25 に保つ。
- `MRTR = Multi Round-Trip Request`（HITL 多段承認の対話往復）。行政書士承認ゲート（T3）の自然な表現。
- `logging` capability は広告しない（ステートレス + WORM 監査が正本）。現状維持。
- SDK は `@modelcontextprotocol/sdk ^1.29.0`（最新安定版、`apps/server/package.json`）。

---

## 4. 絶対に触ってはいけない境界（人間レビュー必須）

- 免責文言（`DISCLAIMER_BY_LANG`、`src/disclaimers.ts`）の削除・弱体化。
- 認証ゲート（OAuth scope step-up / `gyoseishoshi_verified` 署名 JWT クレーム判定）の緩和。
- PII ガード（`scrubInputForPII` / 出力サニタイザ）のバイパス。
- `.well-known/` の整合性、シークレット（環境変数・Secret Manager）。
- **Server Card のデュアル広告**（`protocolVersions` の両バージョン広告）。
- **`initialize` の RC 分岐ロジック**（RC 非対応クライアントへの `2025-11-25` フォールバック）。
- `logging` capability の新規広告（不広告を維持）。
- `.cursor/mcp.json` の編集（CVE-2025-54136 緩和）。
- 新たな書き込み／変更ツールの追加（ADR-024 で承認された 2 ツール以外は不可）。

---

## 5. スタック / コード規約

- Node 22 LTS、TypeScript 5.7+（`strict` / `noUncheckedIndexedAccess`）、ES2022、NodeNext。
- `@modelcontextprotocol/sdk ^1.29`、Zod ^3.23（v4 ではない）、pnpm workspaces + Turborepo。
- Cloud Run asia-northeast1、BYOSA、Workload Identity Federation。
- `any` 禁止（やむを得ない場合は `// @ts-expect-error: <理由>`）。環境変数は `process.env["KEY"]`。
- 命名：ツール=snake_case、ファイル=kebab-case、型/クラス=PascalCase。
- コミットは Conventional Commits（`feat`/`fix`/`docs`/`chore`/`refactor`/`test`）。

詳細・強制ルールは `.cursor/rules/00-global-context.mdc` および `.cursor/rules/01-code-standards.mdc` を正とする。

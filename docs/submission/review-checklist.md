# 審査フォーム要件チェックリスト / Review Submission Checklist / Daftar Periksa Pengajuan

> Anthropic Connectors Directory と OpenAI Apps の提出フォーム要件、および本サービスの現状充足状況。
> 凡例 / Legend: ✅ 充足 / ⚠️ 一部・対応中 / 未 未対応 / 要確認 最新フォーム要件の確認が必要。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`

---

## 0. 二大却下要因への対応 / Top rejection causes

| 却下要因 | 状況 | 備考 |
|---|---|---|
| プライバシーポリシー欠如 | ⚠️ | `/privacy` は live 200 で公開済み（`docs/privacy/*`）。ただし**完全版は行政書士レビュー後に確定（T8 で対応中）**。現状は「Active public draft — Pending final gyoseishoshi review」。 |
| ツールアノテーション欠如 | ✅ | 全 9 ツールに `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` / `title` を付与済み。起動時に `validateToolAnnotations` で整合性検証。読み取り 6 ツールは `readOnlyHint: true`。 |

---

## 1. Anthropic Connectors Directory 要件

| 要件 | 状況 | 備考 |
|---|---|---|
| `/.well-known/mcp.json` で発見可能 | ✅ | Server Card 公開済み。 |
| HTTPS 有効（証明書 ACTIVE） | ✅ | Google-managed cert。 |
| 匿名アクセス可能（auth: none） | ✅ | 読み取り専用コネクタ。 |
| health check が 200 | ✅ | — |
| 全ツールが `tools/list` に表示 | ✅ | 内部ヘルパー `_ssw_checklist_schema` は公開登録から除去済み。 |
| 全レスポンスに免責事項 | ✅ | `DISCLAIMER_BY_LANG`。 |
| ツールアノテーション（read-only 等） | ✅ | 上記 0 参照。 |
| プライバシーポリシー URL | ⚠️ | 公開済み・完全版は T8 で対応中。 |
| Terms of Service URL | ⚠️ | 要確認: 現状 privacy と同一 URL を指定。独立 ToS の要否を確認。 |
| ライセンス明示 | ✅ | Apache-2.0。 |
| ロゴ PNG（≥ 512×512） | ✅ | `icon-512.png`。 |
| スクリーンショット 3〜5 枚（PNG・幅 ≥1000px・アプリ応答のみ） | ⚠️ | 取得手順は `docs/submission/screenshots-guide.md`。既存 `docs/screenshots/` に 5 枚コミット済み。`docs/submission/screenshots/` への配置は手順記載のみ（PNG 未コミット）。 |
| デモ動画（≤ 120 秒） | 未 | 人間側ブロッカー（B6）。 |
| 6 ホスト検証（最低 Claude Desktop + Web） | 未 | 人間側ブロッカー（B4）。 |
| Allowed link URIs（公式 go.jp に限定） | ✅ | moj/mhlw/mlit/maff。 |

---

## 2. OpenAI Apps 要件

| 要件 | 状況 | 備考 |
|---|---|---|
| `/.well-known/ai-plugin.json` が 200 JSON | ✅ | live 200。 |
| `/.well-known/openapi.json` が 200 JSON | ✅ | live 200。 |
| `name_for_human` / `name_for_model` | ✅ | SSW Compass Japan / ssw_compass_japan。 |
| `description_for_model`（情報提供のみ明記） | ✅ | 「Information only, not legal advice」。 |
| `contact_email` | ✅ | a_kabe@sugu-kuru.co.jp。 |
| `openai/outputTemplate`（ウィジェット連携） | ✅ | 5 ツールで dual-key（`_meta.ui.resourceUri` + `openai/outputTemplate`）設定済み。 |
| プライバシーポリシー URL | ⚠️ | Anthropic と同様、完全版は T8 で対応中。 |
| スクリーンショット / デモ素材 | ⚠️ | 要確認: OpenAI Apps の最新提出フォームが要求する素材種別・枚数・解像度。 |
| 提出フォームの最新項目 | 要確認 | OpenAI Apps 審査ポータルの最新要件（カテゴリ・審査単位・レビュー基準）を提出直前に確認。 |

---

## 3. コンテンツ / コンプライアンス共通

| 項目 | 状況 | 備考 |
|---|---|---|
| 情報提供のみ（法律行為なし）の明示 | ✅ | 行政書士法§19 準拠。 |
| PII 非取扱い | ✅ | `scrubInputForPII` + Cloud DLP 二段 + 出力サニタイザ。 |
| 一次情報のみ（信頼度 ≥ 0.7） | ✅ | Vertex AI Search、primary_source フィルタ。 |
| 越境移転なし | ✅ | asia-northeast1。 |
| 監査ログ 7 年保持 | ✅ | GCS WORM（ADR-015）。 |

---

## 4. 要確認項目（人間が確認すべき点）/ Items to confirm

- Anthropic / OpenAI それぞれの**最新提出フォーム要件**（フィールド・必須素材・枚数・解像度・アスペクト比）。本書は既存パケット（`docs/connectors-directory-submission.md`）時点の情報に基づくため断定しない。
- **Terms of Service** を privacy と分離する必要があるか。
- **プライバシーポリシー完全版**の確定（T8・行政書士レビュー）。
- **デモ動画**（≤120秒）の作成（B6）。
- **6 ホスト検証**（最低 Claude Desktop + Web）の完了（B4）。
- `docs/submission/screenshots/` への PNG 実体配置（本タスクは取得手順のみ）。

---

## 参考 / References

- `docs/submission/screenshots-guide.md` — スクリーンショット取得手順・命名規則。
- `docs/submission/example-prompts.md` — 動作例プロンプト（3 シナリオ × 3 言語）。
- `docs/submission/public-doc-draft.md` — 公開ドキュメント草案。
- `docs/connectors-directory-submission.md` — 既存の提出パケット。
- `docs/submission-readiness-audit.md` — 提出準備監査（ブロッカー一覧）。

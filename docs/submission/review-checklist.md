# 審査フォーム要件チェックリスト / Review Submission Checklist / Daftar Periksa Pengajuan

> Anthropic Connectors Directory と OpenAI Apps の提出フォームで確認する項目。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`
> サポート / Support: `a_kabe@sugu-kuru.co.jp`

---

## 0. 二大却下要因への対応 / Top rejection causes

| 却下要因 | 状況 | 備考 |
|---|---|---|
| プライバシーポリシー欠如 | Ready | `/privacy` は 200 で公開され、本文は `docs/privacy/*` と同期する。 |
| ツールアノテーション欠如 | Ready | 全 9 ツールに `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` / `title` を付与済み。起動時に `validateToolAnnotations` で整合性検証。読み取り 6 ツールは `readOnlyHint: true`。 |

---

## 1. Anthropic Connectors Directory 要件

| 要件 | 状況 | 備考 |
|---|---|---|
| `/.well-known/mcp.json` で発見可能 | Ready | Server Card 公開済み。`auth.type` は `none`。 |
| HTTPS 有効 | Ready | Google-managed certificate 前提の本番 URL。 |
| 匿名アクセス可能 | Ready | `tools/list` は匿名で 6 個の読み取り専用ツールのみ返す。 |
| Pro ツールの露出 | Ready | 認証済み Pro コンテキストで 3 個の Pro ツールが表示される。匿名では非表示。 |
| health check が 200 | Ready | `/health`。 |
| 全レスポンスに免責事項 | Ready | `DISCLAIMER_BY_LANG`。 |
| ツールアノテーション | Ready | 上記 0 参照。 |
| プライバシーポリシー URL | Ready | `https://mcp.ssw-compass.jp/privacy`。 |
| Terms of Service URL | Ready | Server Card は privacy URL を利用規約導線としても提示する。 |
| ライセンス明示 | Ready | Apache-2.0。 |
| ロゴ PNG（≥ 512×512） | Ready | `assets/logo/ssw-compass-icon-512.png`。 |
| スクリーンショット 3〜5 枚 | Ready | `docs/screenshots/` に 5 PNG。取得・確認手順は `docs/submission/screenshots-guide.md`。 |
| デモ動画（≤ 120 秒） | Human action | ポータルが要求する場合、人間が画面収録してアップロードする。 |
| 6 ホスト検証 | Human action | 提出直前に `docs/deploy-runbook.md` とテスト端末で確認する。 |
| Allowed link URIs | Ready | moj/mhlw/mlit/maff 等の一次情報源に限定。 |

---

## 2. OpenAI Apps 要件

| 要件 | 状況 | 備考 |
|---|---|---|
| `/.well-known/ai-plugin.json` が 200 JSON | Ready | `auth.type` は `none`。 |
| `/.well-known/openapi.json` が 200 JSON | Ready | MCP Streamable HTTP endpoint を記載。 |
| `name_for_human` / `name_for_model` | Ready | SSW Compass Japan / ssw_compass_japan。 |
| `description_for_model` | Ready | 情報提供のみ・法的助言ではない旨を明記。 |
| `contact_email` | Ready | `a_kabe@sugu-kuru.co.jp`。 |
| `openai/outputTemplate` | Ready | 5 ツールで dual-key（`_meta.ui.resourceUri` + `openai/outputTemplate`）設定済み。 |
| Widget CSP | Ready | `ui.csp` と `openai/widgetCSP` を共有ヘルパで宣言。外部 fetch はなし。 |
| プライバシーポリシー URL | Ready | `https://mcp.ssw-compass.jp/privacy`。 |
| スクリーンショット / デモ素材 | Ready / Human action | 静止画は `docs/screenshots/`。ポータルが動画を必須化する場合は人間が収録する。 |

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

## 4. 人間が行う提出前作業 / Human Submission Actions

- Anthropic / OpenAI のポータルにログインし、最新の必須フィールドを確認する。
- `docs/screenshots/` の 5 PNG をアップロードする。別名が必要な場合は内容を変えずにコピーする。
- ポータルがデモ動画を要求する場合、120 秒以内で読み取り専用ツールの動作を収録する。
- Claude Desktop / Claude Web / ChatGPT など、対象ホストで本番 URL の接続確認を行う。
- 最終送信ボタンは認証済みの人間アカウントで押す。

---

## 参考 / References

- `docs/submission/screenshots-guide.md` — スクリーンショット取得手順・命名規則。
- `docs/submission/example-prompts.md` — 動作例プロンプト（3 シナリオ × 3 言語）。
- `docs/submission/public-doc-draft.md` — 公開ドキュメント草案。
- `docs/connectors-directory-submission.md` — 既存の提出パケット。
- `docs/submission-readiness-audit.md` — 提出準備監査（ブロッカー一覧）。

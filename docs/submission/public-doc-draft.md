# SSW Compass — 公開ドキュメント草案 / Public Documentation Draft / Draf Dokumentasi Publik

> 審査提出用の公開ドキュメントページ草案。確定文言は人間レビュー後に公開する。
> 本番エンドポイント / Production endpoint: `https://mcp.ssw-compass.jp/mcp`
> ホームページ / Homepage: `https://mcp.ssw-compass.jp`

---

## 1. サービス概要 / Overview / Ikhtisar

SSW Compass は、日本の**特定技能（SSW / 特定技能）ビザ手続き**に関する情報を、
出入国在留管理庁などの**公式一次情報に基づいて**提供する、公開・匿名・読み取り中心の
**MCP アプリ**です。Claude / ChatGPT などの AI アシスタントから「ツール」として呼び出して使います。

- 提供主体 / Operator: スグクル株式会社（Sugukuru Inc.）, 鹿児島県
- 認証 / Auth: 読み取りツール 6 種は匿名・無料（Server Card `auth.type: none`）
- 言語 / Languages: 10 言語入力対応（`ja / en / id / zh-CN / zh-TW / vi / tl / th / km / my`）。
  Vertex grounding の本格対応は ja / en / id、他 7 言語は段階的改善中。
- ライセンス / License: Apache-2.0

**3 つの根本原則（不変）**
1. 個人情報を扱わない（氏名・在留番号・パスポート番号・マイナンバー・完全な生年月日は受け付けない。年月のみ）。
2. 法律行為はしない（情報提供のみ。全回答に免責事項を付与）。
3. 一次情報のみ（公式ソースかつ信頼度 ≥ 0.7。AI の推測にはフォールバックしない）。

---

## 2. 対応ツール / Tools / Alat

### 読み取り専用ツール（6 種・匿名・無料 / L0・L1）

| ツール | 役割 | UI ウィジェット |
|---|---|---|
| `search_visa` | 一次情報源から特定技能・関連手続きを検索 | `ssw-search` |
| `classify_procedure` | 現在資格・希望資格・所在地から必要な申請種別を判定 | `ssw-classify` |
| `get_deadline_timeline` | 法定期限タイムライン（14日以内届出・定期届出・更新・通算5年上限等） | `ssw-timeline` |
| `list_visa_documents` | 申請区分・分野別の必要書類リスト（省略条件適用） | `ssw-checklist` |
| `validate_zairyu_compatibility` | 在留資格と就労の適合性判定（不法就労アラート H06） | `ssw-validate` |
| `list_law_updates` | 入管法・手数料・様式改正の制度変動フィード | （専用ウィジェットなし） |

5 種の MCP App UI ウィジェット（`ui/` 配下）が検索結果・判定・タイムライン・チェックリスト・適合性判定を視覚的に表示します（10言語の母語エラー表示・再試行ボタン付き）。

### Pro tier ツール（3 種・契約ユーザー向けゲート / L2, ADR-024）

Pro ツールは契約ユーザー向けです。匿名の `tools/list` には表示されず、認証済み Pro コンテキストでのみ表示されます。
実行時も scope / HITL ゲートで保護され、匿名・無料ユーザーは拒否されます。

| ツール | 役割 | スコープ |
|---|---|---|
| `prepare_document_package` | 書類パッケージ生成 + GCS 署名 URL（冪等・CAS） | `compass:draft` |
| `submit_gyoseishoshi_approval` | 行政書士承認の記録（多段承認 MRTR・監査 7年保存） | `compass:approve` |
| `get_package_status` | パッケージ状態照会・完了時は新署名 URL 再発行 | `compass:draft` |

---

## 3. 使い方 / How to use / Cara penggunaan

1. 対応する AI アシスタント（Claude Desktop / Claude Web / ChatGPT など）で SSW Compass を有効化する。
2. 特定技能ビザ手続きについて自然言語で質問する（例は `docs/submission/example-prompts.md`）。
3. ツールが一次情報に基づく回答とウィジェットを返す。回答には必ず免責事項が付く。

> 個人情報（氏名・番号・完全な生年月日）は入力しないでください。検出時は自動でブロックされ、処理されません。

---

## 4. 制約 / Constraints / Batasan

- **情報提供のみ**。法的助言・行政書士業務ではありません。
- **改正行政書士法§19**（2026年1月1日施行）: 官公署提出書類の作成を業として行えるのは行政書士のみ。本サービスは値の提示・情報提供にとどまります。
- **PII 非取扱い**: 個人を特定する情報は受け付けず、保存しません（年月のみ）。
- **一次情報のみ**: 出入国在留管理庁等の公式資料に基づき、信頼度 ≥ 0.7 でフィルタ。
- **Pro 契約機能**: 書類パッケージや行政書士承認の記録は、契約・資格確認・HITL 承認を前提とします。

---

## 5. プライバシー方針への導線 / Privacy / Privasi

- プライバシーポリシー / Privacy Policy: `https://mcp.ssw-compass.jp/privacy`
- 個人情報を収集しません。セキュリティ目的のログ（アクセス時刻・ツール種別・エラー）のみを Google Cloud Logging で扱います。
- 監査ログは 7 年保持（行政書士法§9 業務帳簿要件に準拠）。越境移転なし（asia-northeast1）。

---

## 6. 連絡先 / Contact / Kontak

- 運営 / Operator: スグクル株式会社（Sugukuru Inc.）
- 連絡先 / Contact: a_kabe@sugu-kuru.co.jp
- 所在地 / Address: 鹿児島県 / Kagoshima Prefecture, Japan

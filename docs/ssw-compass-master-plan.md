# SSW Compass 改変計画（Cursor 実行前提）

**目的**：SSW Compass を最新 MCP 仕様（2025-11-25）準拠かつ Anthropic Connectors Directory 審査通過水準・一流品質に引き上げる。
**実行体制**：主担当エージェント = **Cursor 3.5**（人間承認 diff・MCP 開発支援・本番コンプライアンスコードのレビュー性が理由）。大量機械的リファクタのみ、使い捨てブランチで Antigravity を補助利用可。**本番リポジトリに対する Antigravity の自律実行・広範なターミナル権限付与は禁止**（D ドライブ全消去事例あり）。
**根拠資料**：本計画は「SSW Compass 最高水準化レポート」「リポジトリ監査＋エージェント比較レポート」に基づく。

---

## 0. 前提と現状サマリ
- **稼働中サーバーの実挙動（確認済み）**：**9 ツール**がライブ（読み取り専用 6＋Pro tier 3）。入力スキーマは Zod／enum 制約・`additionalProperties:false` で堅牢。**全 9 ツールが `outputSchema` を宣言し `structuredContent` を返す（構造化出力は実装済み）。** 既存のテキストブロックは後方互換フォールバックとして併存。免責表示は平易な記述データで適切。データ最終確認日スタンプ（2026-05-29）あり。`submit_gyoseishoshi_approval` はアクセスゲート済み・記録のみ（§19 上は適切な設計）。PII ガードあり。
- **未確認（T0 で要確認）**：`package.json` の SDK バージョン・Node バージョン、サーバーのトランスポート設定と `initialize` の capability（`logging` を広告していないか）、MCP Apps ウィジェットの MIME と `_meta` 形・CSP、`.well-known/mcp.json`（v4.0.0）の中身と `oauth-protected-resource` の有無、OTel／CI／テストの実態。（注：各ツールの `outputSchema`／アノテーションは**実装済みを確認済み**＝T1/T5 完了。下記参照。）
- **仕様ベースライン（重要・実態反映済み）**：本サーバーは**デュアル構成**を採る。
  - **既定申告 = 2025-11-25（安定版）。** Anthropic Connectors Directory の審査は安定版基準で行われるため、`initialize` ネゴシエーションで RC 非対応クライアントには 2025-11-25 で応答する。これを主軸とする。
  - **2026-07-28 RC 機能は実装・本番デプロイ済み。** `server/discover`、ルーティングヘッダ、**MRTR（Multi Round-Trip Request＝HITL 承認の複数往復インタラクション）**、Server Card の両バージョン広告（デュアルアドバタイズ）が稼働中。RC 対応クライアントにはこれらを上乗せ機能として提供する。
  - **方針**：「RC を使わない」ではない。「安定版を既定申告としつつ、RC 機能を後方互換の上乗せとして提供する」が正。RC 機能の本実装はゴールではなく**回帰テスト・整合性検証・ドキュメント化**が残作業（T10 参照）。Roots/Sampling/Logging は非推奨だが未削除（最低 12 か月猶予）＝新規に使わないだけでよい。

---

## 1. セットアップ（エージェント実行の起点）

### S0. リポジトリ取得とダイジェスト化
- 手元に取得：`git clone https://github.com/sugukurukabe/ssw-compass`
- LLM 投入用ダイジェスト生成：`npx repomix`（または `gitingest`）を実行し、全体像を 1 ファイルに。
- リポジトリ直下に `AGENTS.md`（本計画と同梱）を配置。`docs/` に本計画レポート群を配置。
- **受け入れ条件**：`pnpm install && pnpm build && pnpm test` がローカルで通る（通らなければ T0 で原因を報告）。

---

## 2. タスク一覧

各タスクは **1 タスク = 1 小 PR**。受け入れ条件は機械チェック可能な形で記述。対象ファイルは推定（実パスは T0 で確定）。

### ── P0：正当性・コンプライアンス（最優先）──

#### T0. 現状コード監査（他タスクの前提・コード変更なし）
- **内容**：リポジトリを読み、未確認項目を埋める監査レポート `docs/audit-current-state.md` を生成する。
- **報告必須項目**：
  1. `@modelcontextprotocol/sdk` のバージョンと Node バージョン、主要依存。
  2. トランスポート設定（Streamable HTTP か／HTTP+SSE 併用か）と `initialize` の `capabilities`（**`logging` を広告しているか**）、申告プロトコルバージョン文字列。
  3. 9 ツールそれぞれの `outputSchema`／アノテーション（`title`/`readOnlyHint`/…）の有無を表で（**実態：全 9 ツールで `outputSchema` 宣言＋アノテーション付与済み＝T1/T5 完了**）。
  4. `submit_gyoseishoshi_approval` ハンドラの実装要約（記録のみか／ゲートは署名 JWT クレーム判定か）。
  5. MCP Apps ウィジェットの MIME・`_meta` 形（フラット/ネスト）・CSP・postMessage 実装。
  6. `.well-known/mcp.json` の内容、`oauth-protected-resource` の有無。
  7. OTel の有無、CI ワークフロー、テストカバレッジ実測値。
  8. **RC 機能の実装状況とデュアル広告の整合性**：`server/discover`・ルーティングヘッダ・MRTR の実装箇所、Server Card が 2025-11-25 と 2026-07-28 の両方を広告しているか、`initialize` ネゴシエーションが RC 非対応クライアントに 2025-11-25 を正しく返すか（フォールバック経路の有無）。
- **受け入れ条件**：上記 1〜8 が `docs/audit-current-state.md` に明記され、各項目に該当ファイルパスが付いている。コードは未変更。

#### T1. 構造化出力の全ツール実装 — **【完了】**
- **状態**：**完了済み**。全 9 ツール（`apps/server/src/tools/*/index.ts`・`*/handler.ts`）が `outputSchema` を宣言し `structuredContent` を返す。既存テキストブロックは後方互換フォールバックとして併存。免責表示は `structuredContent` 内フィールド＋末尾テキストの両方に入っている。→ 旧計画が「最大の技術ギャップ」とした項目は解消済み。
- **対象（実パス）**：`apps/server/src/tools/*/index.ts`、`apps/server/src/tools/*/handler.ts`。
- **内容（実装済み）**：全 9 ツールに Zod ベースの `outputSchema` を定義し、`structuredContent` を返す。既存の `text` ブロックはフォールバックとして残す。免責表示は `structuredContent` 内の専用フィールド（例 `disclaimer`）＋従来の末尾テキスト両方に入れる。
- **受け入れ条件**：
  - 各ツールの戻り値が自身の `outputSchema` に対してスキーマ検証を通る（テストで検証）。
  - `tsc --noEmit` クリーン、`pnpm test` 全通過、カバレッジ 70%+。
  - 既存テキスト出力の後方互換が壊れていない（スナップショット維持）。

#### T2. プロトコルバージョン・SDK の固定 — **【SDK 部分完了】**
- **状態**：SDK は `@modelcontextprotocol/sdk ^1.29.0`（最新安定版）に固定済み（`apps/server/package.json`）。既定申告プロトコルは安定版 `2025-11-25`、RC `2026-07-28` は Server Card のデュアル広告として上乗せ提供（§0 のデュアル構成参照）。残作業はヘッダ処理・`logging` 非広告の回帰確認（T10 に統合）。
- **対象（実パス）**：`apps/server/package.json`、`apps/server/src/server.ts`、`apps/server/src/index.ts`。
- **内容**：`@modelcontextprotocol/sdk` を最新安定版に更新し、既定申告プロトコルバージョンを `2025-11-25` に固定（RC 非対応クライアントへフォールバック）。`MCP-Protocol-Version` ヘッダ処理を確認。
- **受け入れ条件**：`initialize` 応答とヘッダが（RC 非対応クライアントに対して）`2025-11-25` を返す。`logging` を実装していないなら capability から除去。全テスト通過。

#### T3. `submit_gyoseishoshi_approval` のコンプライアンス強化＋MRTR 連携（境界：人間レビュー必須）
- **内容**：ハンドラが「記録のみ」（who/when/what + 監査 ID）で、書類生成・当局提出を一切行わないことをコードで確認。`gyoseishoshi_verified` を**署名 JWT クレーム**で判定していることを保証。承認結果の監査 ID を `structuredContent` で返す。
- **MRTR 連携**：本ツールは行政書士の承認を要する HITL ゲートであり、RC の **MRTR（Multi Round-Trip Request＝承認の複数往復）** と意味的に一致する。RC 対応クライアントに対しては、承認待ち状態を MRTR の往復として表現し、未承認時は確定せず承認待ちを返す。RC 非対応クライアントには従来どおりゲート未充足エラーで応答する（デュアル構成）。
- **受け入れ条件**：認証ゲート未充足時に副作用ゼロでエラーを返すテスト、署名改ざん JWT を拒否するテストが green。MRTR の往復で「承認前は記録が確定しない／承認後に確定する」ことをテストで検証。RC 非対応クライアントでの後方互換も green。ゲートのバイパス経路がないことをレビューで確認。**人間承認を得てからマージ。**

#### T4. 免責表示の不変性テスト（境界：人間レビュー必須）
- **内容**：免責文言を単一の定数に集約し、「命令形でない平易な記述データである」ことをロックするテストを追加（文言変更時はテストが落ちて人間レビューを強制）。
- **受け入れ条件**：免責定数のスナップショットテストが存在し green。全ツール応答に免責が含まれることをテストで保証。

### ── P1：仕様モダン化・観測性 ──

#### T5. ツールアノテーション付与 — **【完了】**
- **状態**：**完了済み**。全 9 ツールに `title`／`readOnlyHint` 等のアノテーション付与済み。起動時に `validateToolAnnotations`（`apps/server/src/server.ts`）で整合性を検証。
- **対象（実パス）**：`apps/server/src/tools/*/index.ts`、`apps/server/src/server.ts`。
- **内容（実装済み）**：AGENTS.md のルール通りにアノテーションと `title` を付与。`readOnlyHint` の実態は次の通り：
  - 読み取り専用 6 ツール（`search_visa`/`classify_procedure`/`get_deadline_timeline`/`list_visa_documents`/`validate_zairyu_compatibility`/`list_law_updates`）＝`readOnlyHint:true`/`destructiveHint:false`。
  - `submit_gyoseishoshi_approval` と `prepare_document_package` ＝`readOnlyHint:false`（書き込み系）。
  - `get_package_status` ＝`readOnlyHint:true`（状態照会のみ・新署名 URL 再発行は副作用なしの読み取り扱い）。
- **受け入れ条件**：`tools/list` 応答で全ツールに `title` と適切な hint が含まれることをテストで検証。

#### T6. MCP Apps ウィジェットの仕様準拠化
- **対象（推定）**：`src/ui/*` / `widgets/*`、リソース登録部。
- **内容**：MIME を `text/html;profile=mcp-app` に統一。リンクをネスト型 `_meta.ui.resourceUri` へ（旧フラット型は後方互換で温存可）。`_meta.ui.csp`（`connectDomains`/`resourceDomains`）を宣言。postMessage を JSON-RPC 2.0 のみ受理しそれ以外は無視。ダークモードを `[data-theme="dark"]` 対応に。テキストフォールバックを保証。
- **受け入れ条件**：Claude Desktop と Claude Web の両方でウィジェットが描画され、JSON-RPC 以外の postMessage で iframe がクラッシュしないことを手動検証チェックリストで確認。ユニットテストで `_meta` 形と MIME を検証。

#### T7. OpenTelemetry 計装
- **対象（推定）**：サーバー初期化、ツール実行ラッパー、Cloud Run。
- **内容**：ツール呼び出しごとのスパン＋ Vertex AI 取得の子スパンを Cloud Trace へエクスポート。PII／シークレットを秘匿。`logging` 依存を残さない。
- **受け入れ条件**：トレースに PII が含まれないことをテストで検証。Cloud Trace でスパンが確認できる（手動検証）。

#### T8. プライバシーポリシー／`.well-known` 整備（審査ブロッカー対応）
- **内容**：完全なプライバシーポリシー（収集データ・利用・保管・7 年 WORM 保持・PII 非共有・連絡先）を安定 HTTPS URL で公開。`.well-known/mcp.json` を正確化。OAuth を公開する場合のみ `oauth-protected-resource` を用意。
- **受け入れ条件**：`curl -fsS https://mcp.ssw-compass.jp/privacy` が placeholder ゼロの完全版を返す。`.well-known/mcp.json` が実態と一致。

#### T9. 審査用アセット整備（審査ブロッカー対応）
- **内容**：UI ウィジェットの 3〜5 枚 PNG スクリーンショット（幅 1000px 以上、アプリ応答のみにクロップ、プロンプトは含めない）、3 つの動作例プロンプト、公開ドキュメントページを用意。
- **受け入れ条件**：スクショ・プロンプト・ドキュメントが `docs/submission/` に揃い、Anthropic／OpenAI フォーム要件を満たす。

### ── P2：RC 機能の検証・回帰・将来対応 ──

#### T10. RC 機能（デプロイ済み）の検証・回帰テスト・ドキュメント化
- **前提**：`server/discover`・ルーティングヘッダ・MRTR・Server Card デュアル広告は**実装・本番デプロイ済み**。本タスクは新規実装ではなく、その**整合性検証・回帰テスト・ドキュメント化**。
- **内容**：
  - `initialize` ネゴシエーションが RC 対応／非対応クライアントの双方で正しく分岐すること（RC 非対応には 2025-11-25 を返す）を回帰テスト化。
  - Server Card が両バージョンを矛盾なく広告していること、`server/discover` の応答が `.well-known` と一致することを検証。
  - 接続ごとの隠れ状態がないこと（ステートレス性）をテストで確認。`ttlMs`/`cacheScope` の付与状況を確認・必要なら補完。
  - RC 機能の挙動と互換マトリクスを `docs/rc-features.md` に文書化。
- **受け入れ条件**：RC 対応／非対応の双方のネゴシエーションパスを覆う回帰テストが green。デュアル広告の整合性テストが green。`docs/rc-features.md` が揃う。

#### T11. Pro/JWT 認可ハードニング
- **内容**：`iss`/`aud` 検証、RFC 9728 PRM・RFC 8707 リソースインジケータ対応、（必要なら）CIMD 採用。トークンパススルー禁止の徹底。
- **受け入れ条件**：不正 `aud`／改ざん署名／他サーバー向けトークンを拒否するテストが green。

#### T12. OpenAI Apps SDK 対応（任意・並行）
- **内容**：`_meta["openai/widgetCSP"]`（外部リンク用 `redirect_domains` 含む）追加。レスポンス最小化（トレース／セッション ID を出力に含めない）。**ChatGPT 内で Pro サブスクの販売・アップセルをしない**（外部チェックアウトへ誘導）。グローバルデータレジデンシーのプロジェクトから申請。
- **受け入れ条件**：ChatGPT でウィジェットが描画。ツール応答に内部 ID が含まれないことをテストで検証。

---

## 3. マイルストーン
1. **M1：監査完了** = T0。
2. **M2：仕様準拠コア** = T1〜T5。最新仕様の構造化出力＋アノテーション＋コンプライアンスが揃う。**進捗：T1（構造化出力）・T5（アノテーション）は完了、T2（SDK 固定）は SDK 部分完了。残りは T3／T4 の境界レビュー。**
3. **M3：審査提出可能** = T6・T8・T9（＋ T4）。Connectors Directory の二大却下要因（プライバシーポリシー・アノテーション）を解消。→ **Anthropic Connectors Directory 申請**。
4. **M4：一流品質** = T7。観測性が揃う。
5. **M5：RC 検証・将来対応** = T10（RC 機能の回帰・整合性検証）〜T12。

---

## 4. リスクと留意
- **実コード未確認**：本計画の対象ファイルは推定。T0 で確定させてから T1 以降に進む。差異があれば計画を実態に合わせて更新。
- **境界の事故**：T3・T4・T6・T8 は免責・認証ゲート・`.well-known` に触れる。必ず人間レビューを挟む。
- **仕様の流動性とデュアル構成**：2026-07-28 はまだ RC。本サーバーは RC 機能を実装・デプロイ済みだが、**既定申告は安定版 2025-11-25**に保ち、RC 機能は後方互換の上乗せとして提供する（審査は安定版基準のため）。RC 既定切り替えは安定版公開後に判断。Roots/Sampling/Logging は非推奨だが未削除（最低 12 か月猶予）＝新規に使わないだけでよい。
- **エージェント自律性**：Antigravity は使い捨てブランチ限定。最終 diff は必ず Cursor で人間レビューしてマージ。

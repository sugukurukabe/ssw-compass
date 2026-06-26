# MCP App ウィジェット手動検証チェックリスト

# Manual verification checklist for MCP App widgets

# Daftar periksa verifikasi manual untuk widget MCP App

> 対象 / Scope / Cakupan: `ui/ssw-search`, `ui/ssw-classify`, `ui/ssw-timeline`,
> `ui/ssw-checklist`, `ui/ssw-validate`
>
> 自動テスト (`pnpm build` / `pnpm -r --filter './ui/**' typecheck` / `pnpm test`)
> が緑であることを前提に、ホスト上での描画と挙動を人間が確認する。
> Assumes CI is green; this covers human-in-the-loop host rendering checks.
> Mengasumsikan CI hijau; ini mencakup pemeriksaan render pada host oleh manusia.

---

## 0. 事前準備 / Prerequisites / Prasyarat

1. `pnpm build` を実行し、各 `ui/*/dist/mcp-app.html` が再生成され、postbuild
   (`scripts/compute-csp-hashes.mjs`) が `CSP enforcing applied` を出力すること。
   Run `pnpm build`; confirm each dist is rebuilt and CSP hardening is applied.
   Jalankan `pnpm build`; pastikan tiap dist dibangun ulang dan CSP diperketat.
2. 本番同等の MCP サーバーを起動 (`UI_DIST_ROOT` が dist を指すこと)。
   Start the MCP server pointing `UI_DIST_ROOT` at the built dist.
   Jalankan server MCP dengan `UI_DIST_ROOT` menunjuk ke dist.

---

## 1. T6 仕様準拠 / T6 spec compliance / Kepatuhan spesifikasi T6

| # | 確認項目 / Check / Periksa | 期待 / Expected / Diharapkan |
| - | --- | --- |
| 1.1 | UI リソースの MIME | `text/html;profile=mcp-app` (`RESOURCE_MIME_TYPE`) で配信される |
| 1.2 | ツール `_meta` のリンク形 | ネスト型 `_meta.ui.resourceUri` を宣言 (旧フラットは後方互換のみ) |
| 1.3 | リソース `_meta.ui.csp` | `connectDomains` / `resourceDomains` 等を宣言 |
| 1.4 | CSP | dist の meta CSP に `'unsafe-eval'` が無く、`require-trusted-types-for 'script'` がある |
| 1.5 | ダークモード | `[data-theme="dark"]` で配色が反転する (下記 §3) |

- 1.1〜1.3 はサーバー側 `apps/server/src/tools/*/ui.ts` と `*/index.ts` で実装済み。
  ブラウザの devtools またはサーバーログでレスポンスを確認する。
  Verify via devtools/server logs; these live in the server's `ui.ts` / `index.ts`.

---

## 2. postMessage が JSON-RPC 2.0 限定であること / JSON-RPC-only postMessage

> 受理は `@modelcontextprotocol/ext-apps` の `PostMessageTransport` が担う。
> 非 JSON-RPC メッセージは `console.debug("Ignoring non-JSON-RPC message", ...)`
> でドロップされ、iframe はクラッシュしない (SDK 実装で保証)。
> Acceptance is handled by the SDK transport, which drops non-JSON-RPC messages
> without crashing the iframe.

手順 / Steps / Langkah:

1. ウィジェットを描画したホストの devtools コンソールを開く。
2. 親ウィンドウから不正メッセージを送る:

```js
// 1) JSON でない文字列
frame.contentWindow.postMessage("not-json", "*");
// 2) jsonrpc フィールドの無いオブジェクト
frame.contentWindow.postMessage({ hello: "world" }, "*");
// 3) jsonrpc が "2.0" でないオブジェクト
frame.contentWindow.postMessage({ jsonrpc: "1.0", method: "x" }, "*");
```

3. 期待: いずれの場合も **iframe は描画を維持** し、例外で白画面化しない。
   コンソールに `Ignoring non-JSON-RPC message` または無視のログが出る。
   Expected: the iframe keeps rendering; no uncaught exception / blank-out.
   Diharapkan: iframe tetap merender; tanpa pengecualian / layar kosong.

---

## 3. ライト/ダーク表示 / Light & dark rendering / Tampilan terang & gelap

各ウィジェットで以下を確認する / For each widget / Untuk tiap widget:

1. ホストがライトテーマのとき: 既存の配色 (白背景・濃紺アクセント) で表示される。
2. ホストがダークテーマ (`data-theme="dark"` を push) のとき:
   - 背景が暗色、本文が明色、コントラストが読みやすい。
   - アクセント・バッジ・信頼度バー・期限の赤点・H06 警告が暗色背景でも視認できる。
3. ホストがテーマを push せず OS がダークのとき:
   `@media (prefers-color-scheme: dark)` のフォールバックで暗色になる。
   ただしホストが明示的に `data-theme="light"` を出した場合はライトを維持する。

---

## 4. テキストフォールバック / Text fallback / Cadangan teks

> ウィジェット非対応ホスト (構造化 UI を描画しないクライアント) でも、ツールの
> テキスト出力で内容が読めること。`structuredContent` と併せてテキストブロックも
> 返るため、UI 無しでも要点・免責が伝わる。

1. ウィジェットを描画しないクライアント (またはテキストのみ表示モード) で各ツールを実行。
2. 期待: 要点・出典・**免責 (`DISCLAIMER_BY_LANG`)** がテキストとして読める。
   Expected: key points, sources and the disclaimer are readable as text.
   Diharapkan: poin utama, sumber, dan disclaimer terbaca sebagai teks.

---

## 5. UX クイックウィン / UX quick wins / Peningkatan UX

共通 / Common / Umum:

- [ ] 右上の言語切替 (日本語 / English / Bahasa) で表示言語が即時に切り替わる。
      切替後にホスト locale が変わっても、利用者の選択が維持される。
- [ ] キーボード操作: Tab でフォーカス移動でき、`:focus-visible` のリングが見える。
- [ ] エラー時: `renderLocalizedErrorNotice` の再試行ボタンが表示され、skeleton で固まらない。

ウィジェット固有 / Per widget / Per widget:

- [ ] **search**: 各結果に信頼度バー (%) と「URLをコピー」、要点に「出典をすべてコピー」。
      空結果時は明確な空状態メッセージ。
- [ ] **classify**: 判定の信頼度バッジ (high/mid/low) と「前提条件」(`details`) が表示される。
      参照は官公庁 (`safePrimaryHref`) リンクのみ。
- [ ] **timeline**: 期限が確定した項目が赤点で強調。関連様式ごとに「URLをコピー」。
- [ ] **checklist**: 進捗 (確認済み X / Y) バー、各書類の「原典を開く」、「リストをコピー」。
- [ ] **validate**: ILLEGAL 判定時に最上部へ H06 赤警告バナー。根拠・推奨確認事項を整理表示。

---

## 6. コンプライアンス境界 / Compliance boundaries / Batas kepatuhan

- [ ] L1 (羅針盤の短い注記) と L2 (`DISCLAIMER_BY_LANG` 全文) が両方表示される。
- [ ] L2 免責文言は逐語のまま (改変・要約・省略なし)。
- [ ] 法律行為を示唆する文言が無い (情報提供のみ・§19 準拠)。
- [ ] DOMPurify によるサニタイズ後に描画され、リンクは許可ドメインのみ。

---

## 7. 対応ホスト / Hosts to test / Host yang diuji

最低限、以下 2 ホストで §3〜§6 を確認する。
At minimum verify §3–§6 on the following two hosts.
Minimal verifikasi §3–§6 pada dua host berikut.

- [ ] Claude Desktop
- [ ] Claude (Web)

任意 / Optional / Opsional: ChatGPT (Apps), MCP Inspector, その他の MCP Apps 対応ホスト。

---

## 8. T12 OpenAI Apps SDK widget CSP + レスポンス最小化

## 8. T12 OpenAI Apps SDK widget CSP + response minimization

## 8. CSP widget OpenAI Apps SDK T12 + minimisasi respons

> 自動テスト (`apps/server/test/tools/widget-csp.test.ts`,
> `apps/server/test/tools/response-minimization.test.ts`) が緑であることを前提に、
> ChatGPT (Apps) 実機での描画と外部誘導の挙動を人間が確認する。ChatGPT 実描画は
> 自動化できないため本節を手動チェックリストとする。
> Assumes the T12 unit tests are green; this section is the manual checklist for the
> parts that cannot be automated (real ChatGPT Apps rendering and external redirect).
> Mengasumsikan unit test T12 hijau; bagian ini adalah daftar periksa manual untuk hal
> yang tidak bisa diotomatiskan (render ChatGPT Apps nyata dan pengalihan eksternal).

### 8.1 widget CSP の宣言 / widget CSP declaration / deklarasi CSP widget

| # | 確認項目 / Check / Periksa | 期待 / Expected / Diharapkan |
| - | --- | --- |
| 8.1 | resource `_meta.ui.csp` (nested) | `connectDomains`/`resourceDomains`/`frameDomains`/`baseUriDomains` を宣言 (現状は空 = 外部接続なし)。MCP/Anthropic と OpenAI の双方が読む正本 |
| 8.2 | resource `_meta["openai/widgetCSP"]` (flat) | `redirect_domains` に外部 Pro origin のみ (`COMPASS_PRO_UPGRADE_URL` の origin)。`connect_domains`/`resource_domains` は ui.csp と整合 (空)。両ホスト併記 |
| 8.3 | 許可ドメイン | redirect は https の単一 origin のみ。ワイルドカード (`*`) や `http:` を含まない |
| 8.4 | dist CSP hardening | `pnpm build` 後の各 `ui/*/dist/mcp-app.html` に `'unsafe-eval'` が無い (`CSP enforcing applied`) |

- 8.1〜8.3 はサーバー側 `apps/server/src/tools/widget-csp.ts` と各 `tools/*/ui.ts` で実装。
  ChatGPT devtools またはサーバーログでリソース応答の `_meta` を確認する。
  Verify the resource `_meta` via ChatGPT devtools / server logs; implemented in `widget-csp.ts`.

### 8.2 ChatGPT (Apps) 実描画 / Live ChatGPT rendering / Render ChatGPT langsung

1. ChatGPT (Apps) で 5 ウィジェット (search/classify/timeline/checklist/validate) を描画。
   期待: §3〜§6 と同様にライト/ダーク・テキストフォールバック・免責 (L1+L2) が表示される。
2. 外部 Pro 誘導 (Phase 2a) のリンクをクリックしたとき:
   期待: `redirect_domains` に宣言した外部 Pro origin への遷移のみ許可される。
   **ChatGPT 内に決済 UI は一切表示されない** (外部チェックアウトへ誘導するのみ)。
3. アップセルは非モーダル・1 回のみ (ダークパターン無し)。新たな煽り文言が増えていないこと。

### 8.3 レスポンス最小化の監査結論 / Response-minimization audit / Audit minimisasi

> 監査範囲: 全 9 ツールの `content` / `structuredContent` / `_meta`。
> Audit scope: `content` / `structuredContent` / `_meta` of all 9 tools.

- **結論: 非機能的な内部識別子の漏洩なし。** trace / session / span ID や内部 DB 行 ID は
  応答に含まれない。OTel trace は span にのみ載り (`apps/server/src/otel.ts`)、応答へは出ない。
  Vertex の `doc_id` は `search_visa` のログにのみ出力し、出力には含めない
  (`apps/server/src/tools/search-visa/handler.ts`)。`withCacheMeta` は `ttlMs`/`cacheScope`/
  `cacheGeneration` (機能的キャッシュヒント) のみを付与する。
  **Conclusion: no non-functional internal IDs leak.** OTel traces live only on spans, and
  Vertex `doc_id` is logged but never emitted; `withCacheMeta` adds only functional cache hints.
- **保持する機能契約 ID (削除しない):** `prepare_document_package` / `get_package_status` の
  `task_id` (ポーリング/再開)、MRTR の `requestState`。これらは利用者が次の操作に使うため必須。
  呼び出し元入力の echo (`case_id` / `draft_document_id` / `idempotency_key` 等) も契約上保持。
  **Preserved functional-contract IDs (never removed):** `task_id`, MRTR `requestState`, and
  echoed caller inputs (`case_id` / `draft_document_id` / `idempotency_key`).
- この契約は `response-minimization.test.ts` で回帰検証する (内部 ID 不在 + `task_id` 保持)。

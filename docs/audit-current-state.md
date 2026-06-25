# T0: 現状コード監査 — SSW Compass (main = prod)

> 監査対象: `main` ブランチ (HEAD `8d4f3e0`)。本番は v2.1/v2.2 相当。
> 前提の優先順位 (precedence): **本番実態 > マスタープラン > 個別ファイル**。
> 本書は実コードの現状実態のみを根拠とし、各項目にファイルパスを添える。
> 注: `docs/ssw-compass-master-plan.md` は本監査時点で `main` に未マージ
> (別ブランチでステージング中)。PR #106 も未マージのため main には含まれない。
> 検証コマンド: `pnpm -F @ssw/server test` / `pnpm test` ともに緑 (後述)。

---

## 1. SDK / Node バージョン・主要依存・申告プロトコルバージョン

### 依存バージョン (`apps/server/package.json`)

| 項目 | 値 | パス |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | `^1.29.0` | `apps/server/package.json:27` |
| `@modelcontextprotocol/ext-apps` | `^1.6.0` | `apps/server/package.json:26` |
| `zod` | `^3.23.0` (v4 ではない) | `apps/server/package.json:35` |
| `zod-to-json-schema` | `^3.23.0` | `apps/server/package.json:36` |
| `express` | `^4.21.0` | `apps/server/package.json:33` |
| `pino` | `^10.3.1` | `apps/server/package.json:34` |
| `@opentelemetry/sdk-node` / `exporter-trace-otlp-http` | `^0.55.0` | `apps/server/package.json:29-30` |
| `@google-cloud/*` (discoveryengine, dlp, storage, tasks, secret-manager, logging) | 各 `^2`〜`^11` | `apps/server/package.json:19-25` |
| `@supabase/supabase-js` | `^2.108.1` | `apps/server/package.json:32` |
| `typescript` (dev) | `^5.7.0` | `apps/server/package.json:45` |
| `@types/node` (dev) | `^22.0.0` | `apps/server/package.json:43` |
| `vitest` (dev) | `^2.1.0` | `apps/server/package.json:46` |

- **Node バージョン**: `package.json` に `engines` 宣言はないが、CI は `node-version: 22`
  (`.github/workflows/ci.yml:27`)、pnpm `10.33.0` (`.github/workflows/ci.yml:32`)。
  ローカル実行ランタイムはテストログ上 `v24.12.0` で動作 (互換)。

### 申告プロトコルバージョン文字列

| 申告経路 | 値 | パス |
| --- | --- | --- |
| SDK ネゴシエーション (既定) | SDK `^1.29` の安定版 = **`2025-11-25`** を `initialize` で申告 | `apps/server/src/server.ts:49-56` (`createMcpServer` は SDK 既定にネゴシエーションを委譲) |
| Server Card `protocolVersions` | `["2025-11-25", "2026-07-28"]` (デュアル広告) | `apps/server/src/server-card.ts:107` |
| `server/discover` の `protocolVersions` | `["2025-11-25", "2026-07-28"]` | `apps/server/src/index.ts:101` |
| RC 定数 | `RC_PROTOCOL_VERSION = "2026-07-28"` | `apps/server/src/index.ts:17` |

**計画推定 vs 実態の差分**: マスタープラン/ AGENTS.md の「既定申告は安定版 2025-11-25、
Server Card は両版広告」はそのまま実態と一致。`serverInfo.version` は `1.0.0`
(`server.ts:46`, `index.ts:102`) だが Server Card の `version` は `2.1.0`
(`server-card.ts:69`) — **バージョン文字列が2系統で不一致** (製品版数 vs SDK serverInfo)。
監査上は意図的な使い分けと判断できるが、ドキュメント整合の余地あり。

---

## 2. トランスポート設定と `initialize` の `capabilities`

### トランスポート (`apps/server/src/index.ts`)

| 観点 | 実態 | パス |
| --- | --- | --- |
| 種別 | **Streamable HTTP** (`StreamableHTTPServerTransport`) | `index.ts:1, 285` |
| ステートフル/ステートレス | **ステートレス** (`sessionIdGenerator: undefined`、リクエスト毎に server+transport を生成) | `index.ts:280-291` |
| `mcp-session-id` 発行 | なし (ステートレスのため) | `index.ts:264-269` (コメント) |
| HTTP メソッド | `POST /mcp` のみ受理。`GET`/`DELETE /mcp` は **405 Method Not Allowed** | `index.ts:270, 314-326` |
| HTTP+SSE 併用 | なし (ステートレスでサーバ起点 SSE/セッションを保持しない) | `index.ts:312-313` (コメント) |
| ボディ上限 | `1 MiB` (`express.json({ limit })`) | `index.ts:16, 112` |

### capabilities (`apps/server/src/server.ts`)

```51:56:apps/server/src/server.ts
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
```

| capability | 広告 | パス |
| --- | --- | --- |
| `tools` | yes | `server.ts:52` |
| `resources` | yes | `server.ts:53` |
| `prompts` | yes | `server.ts:54` |
| **`logging`** | **no (非広告)** | `server.ts:50-56` に `logging` キーは存在しない |

**logging 広告の有無 = NO。** AGENTS.md §3「`logging` capability は広告しない
(ステートレス + WORM 監査が正本)」と一致。

**計画推定 vs 実態の差分**: `initialize` capabilities では `prompts: {}` を広告し、実際に
3 プロンプトを登録 (`server.ts:72`, `prompts/workflows.ts`)。一方 **Server Card の
`capabilities.prompts` は `false`** (`server-card.ts:84`) で、**MCP `initialize` 広告と
Server Card の表記が矛盾**している (実態は prompts 提供中)。要整合 (T5 周辺の残作業候補)。

---

## 3. 9 ツールの outputSchema / アノテーション一覧

全 9 ツールが `outputSchema` を宣言し `structuredContent` を返す。読み取り専用 6 ツール
のうち UI ウィジェット付き 5 ツールは `registerAppTool`、`list_law_updates` と
Pro 3 ツールは `server.registerTool` を使用。

| ツール | 登録 | outputSchema | title | readOnlyHint | destructiveHint | idempotentHint | openWorldHint | パス |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `search_visa` | `registerAppTool` | `SearchVisaOutput` | あり | true | false | true | false | `tools/search-visa/index.ts:13-53` |
| `classify_procedure` | `registerAppTool` | `ClassifyProcedureOutput` | あり | true | false | true | false | `tools/classify-procedure/index.ts:10-51` |
| `get_deadline_timeline` | `registerAppTool` | `GetDeadlineTimelineOutput` | あり | true | false | true | false | `tools/get-deadline-timeline/index.ts:13-56` |
| `list_visa_documents` | `registerAppTool` | `ListVisaDocumentsOutput` | あり | true | false | true | false | `tools/list-visa-documents/index.ts:13-54` |
| `validate_zairyu_compatibility` | `registerAppTool` | `ValidateZairyuCompatibilityOutput` | あり | true | false | true | false | `tools/validate-zairyu-compatibility/index.ts:13-50` |
| `list_law_updates` | `registerTool` | `ListLawUpdatesOutput` | あり | true | false | true | false | `tools/list-law-updates/index.ts:10-41` |
| `submit_gyoseishoshi_approval` | `registerTool` | `SubmitGyoseishoshiApprovalOutput` | あり | **false** | false | false | false | `tools/submit-gyoseishoshi-approval/index.ts:16-47` |
| `prepare_document_package` | `registerTool` | `PrepareDocumentPackageOutput` | あり | **false** | false | true | **true** | `tools/prepare-document-package/index.ts:15-55` |
| `get_package_status` | `registerTool` | `GetPackageStatusOutput` | あり | true | false | true | **true** | `tools/get-package-status/index.ts:15-60` |

補足:
- 各ツールの `*_ANNOTATION` 定数 (例 `SEARCH_VISA_ANNOTATION`) には MCP 標準 4 ヒントに加え
  `legalLevel` / `requiresGyoseishoshiAuth` / `hitlControls` / `tier` の SSW 拡張属性を保持
  (`SswCompassToolAnnotation` 型)。
- 起動時に `validateToolAnnotations([...])` が全 9 ツールの整合性を検証し、不整合なら
  `ToolAnnotationConfigError` で起動失敗 (`server.ts:80-102`)。
- `registerAppTool` 系は `annotations` に SSW 拡張属性付き定数を渡すが、`registerTool` 系
  (list_law_updates / Pro 3) は標準 4 ヒントのみをインラインで渡し、拡張属性は
  `*_ANNOTATION` 定数側に保持 (検証用)。

**計画推定 vs 実態の差分 (T1/T5)**:
- **T1 (構造化出力) は完了済み**。根拠: 9 ツール全てが `outputSchema` を宣言 (上表)、
  ハンドラは `structuredContent` を返す (例 `submit-gyoseishoshi-approval/handler.ts:152-161`,
  206-214)。テキスト出力は後方互換フォールバックとして併存。
- **T5 (アノテーション) は完了済み**。根拠: 全 9 ツールが 4 ヒント + `title` を宣言し、
  起動時に `validateToolAnnotations` で強制検証 (`server.ts:80-102`)。書き込み系 2 ツール
  (`submit_gyoseishoshi_approval` / `prepare_document_package`) のみ `readOnlyHint:false`、
  `get_package_status` は照会のみで `readOnlyHint:true` (`get-package-status/index.ts:16-18`
  のコメント根拠) で、ADR-024 / AGENTS.md §2 と一致。

---

## 4. `submit_gyoseishoshi_approval` ハンドラ実装要約

ファイル: `apps/server/src/tools/submit-gyoseishoshi-approval/handler.ts`

処理フロー (`_submitGyoseishoshiApprovalInner`):
1. 入力を `SubmitGyoseishoshiApprovalInput.parse` で検証 (`handler.ts:39`)。
2. `scrubInputForPII(args)` で PII ブロック (在留番号・パスポート番号・マイナンバー等)。
   ブロック時は免責付きエラーを返す (`handler.ts:42-60`)。
3. **HITL ゲート**: `assertHitlGate(authContext, "submit_gyoseishoshi_approval", "L2")`
   (`handler.ts:61`)。
4. `approval_method === "esign"` は Sprint 4 未実装 (`throw`) (`handler.ts:62-66`)。
5. `seal_image_base64` は **SHA-256 ハッシュ化のみ** (画像本体は保存しない) (`handler.ts:67-69`)。
6. MRTR 経路 (`requestState` あり): `applyApprovalInputResponse` で承認状態遷移
   (`handler.ts:70-92`)。
7. **監査イベントを応答組み立て前に必ず `emitAuditEvent` で記録** (H04 7年保存)
   (`handler.ts:118, 184`)。`actor.user_id_hash` は `sha256Hex` でハッシュ化、PII は保存しない。

**「記録のみか / ゲートは署名 JWT クレーム判定か」**:
- **本ツールは『記録 (audit + 承認状態遷移)』が本体** であり、政府書類の生成・提出は行わない。
- **ゲートは署名 JWT クレーム判定**: `assertHitlGate` (`hitl/lockgate.ts:43-73`) は
  `AuthContext.tier` と `AuthContext.gyoseishoshi_verified` を見る。これらは
  `JwtTokenVerifier.verify` が **HS256 署名検証後** に JWT クレーム
  (`tier` / `gyoseishoshi_verified`) からマッピングした値 (`auth/token-verifier.ts:130-138`)。
  - `tier === "free"` → `HitlGateError` (`lockgate.ts:53-59`)。
  - `gyoseishoshi_verified !== true` → `HitlGateError` (`lockgate.ts:61-72`)。
- スコープゲートも二重で存在: `submit_gyoseishoshi_approval` は `compass:approve` 必須
  (`auth/scopes.ts:19`)。`compass:approve` は `tier∈{pro,business}` かつ
  `gyoseishoshi_verified` のときのみ付与 (`scopes.ts:28-30`)。HTTP 層で `enforceScopes`
  が 403 + `WWW-Authenticate` を返す (`index.ts:36-57`)。

### token-verifier の検証範囲 (`apps/server/src/auth/token-verifier.ts`)

| 検証項目 | 実装 | パス |
| --- | --- | --- |
| 構造 (3 パート) | あり | `token-verifier.ts:76-80` |
| `alg === "HS256"` | あり (alg confusion 対策) | `token-verifier.ts:94-100` |
| HS256 署名 (`timingSafeEqual`) | あり | `token-verifier.ts:50-62, 102-105` |
| `exp` 失効 | あり | `token-verifier.ts:107-111` |
| `tier` 値検証 | あり | `token-verifier.ts:113-122` |
| **`iss` (issuer)** | **未検証** | `JwtClaims` に `iss` なし (`token-verifier.ts:34-42`) |
| **`aud` (audience)** | **未検証** | `JwtClaims` に `aud` なし |
| `nbf` / `iat` 妥当性 | `iat` は読むが未検証 / `nbf` なし | `token-verifier.ts:136` |

**計画推定 vs 実態の差分 (T11 残)**: **token-verifier は iss/aud を検証していない**
(クレーム自体を読まない)。HS256 自己検証 + exp + tier のみ。AGENTS.md / マスタープラン上の
「iss/aud 検証」は **未実装 (T11 残)**。`ADR-013` の Interface Freeze で `verify()` シグネチャは
不変とされている (`token-verifier.ts:6-8, 20-24`) ため、追加検証はクレーム拡張で対応する必要。

---

## 5. MCP Apps ウィジェット (MIME / `_meta` 形 / CSP / postMessage)

### MIME

- リソース MIME は `@modelcontextprotocol/ext-apps` の `RESOURCE_MIME_TYPE`
  = **`text/html;profile=mcp-app`** (`node_modules/@modelcontextprotocol/ext-apps/dist/src/app.d.ts:78`)。
  各 UI リソースで使用 (`tools/search-visa/ui.ts:24` 他 5 ファイル)。

### `_meta` 形 (flat / nested)

- **ツール登録の `_meta` は OpenAI キーが flat、UI 参照は nested**。例 (`tools/search-visa/index.ts:40-50`):

```40:50:apps/server/src/tools/search-visa/index.ts
      _meta: {
        icons: SSW_COMPASS_TOOL_ICONS,
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "公式情報源を確認中…",
        "openai/toolInvocation/invoked": "結果を表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
```

  - `ui.resourceUri` は **nested**、`openai/*` は **flat (slash 区切りキー)** の併用 (dual-key)。
    `.cursor/rules/tools.mdc` の「`_meta.ui.resourceUri` AND `_meta["openai/outputTemplate"]` の
    dual-key」要件を満たす。
- **UI リソース側の `_meta` は nested** (`ui: { prefersBorder, csp: {...} }`)
  (`tools/search-visa/ui.ts:26-35`)。

### CSP

- **ウィジェット HTML 内の `<meta http-equiv="Content-Security-Policy">`** (`ui/ssw-search/mcp-app.html:6-9`):

```7:9:ui/ssw-search/mcp-app.html
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none';"
```

  - **`'unsafe-eval'` は不在** (グローバル禁止ルールと一致)。`script-src 'self' 'unsafe-inline'`。
- **リソース `_meta.ui.csp`** は `connectDomains/resourceDomains/frameDomains/baseUriDomains`
  を全て空配列で宣言 (外部接続なし) (`tools/search-visa/ui.ts:29-34`)。

### postMessage 実装

- ウィジェットは **`@modelcontextprotocol/ext-apps` の `App` + `PostMessageTransport`** を使用。
  生 `window.postMessage` を直書きせず SDK 経由 (`ui/ssw-search/src/main.tsx:1, 44, 93`):

```93:93:ui/ssw-search/src/main.tsx
await app.connect(new PostMessageTransport(window.parent, window.parent));
```

  - `app.onhostcontextchanged` / `ontoolinput` / `ontoolresult` でホスト連携
    (`main.tsx:50-83`)。Claude Web の strict CSP 対策として `applyHostFonts` /
    `applyHostStyleVariables` をスキップする旨のコメントあり (`main.tsx:46-49`)。
- `@ssw/ui-bridge` パッケージは DOM ヘルパ / trusted-html / i18n のみを export し、独自の
  postMessage 層は持たない (`packages/ui-bridge/src/index.ts:1-9`)。

**計画推定 vs 実態の差分**: MIME・dual-key `_meta`・CSP・SDK 経由 postMessage はいずれも
実装済みで MCP Apps / OpenAI Apps SDK 要件と整合。差分は特になし。

---

## 6. `.well-known/*` と Server Card

### 公開エンドポイント (`apps/server/src/index.ts`)

| パス | 内容 | パス |
| --- | --- | --- |
| `/.well-known/mcp.json` | `buildServerCard()` を返す | `index.ts:244-250` |
| `/.well-known/mcp-server-card.json` | `buildServerCard()` を返す (同内容) | `index.ts:252-258` |
| `/.well-known/ai-plugin.json` | OpenAI Apps SDK マニフェスト (`auth: { type: "none" }`) | `index.ts:119-149` |
| `/.well-known/openapi.json` | 最小 OpenAPI 3.1.0 文書 | `index.ts:154-223` |
| `/privacy` | プライバシーポリシー (text/plain) | `index.ts:226-242` |
| `/health` | ヘルスチェック | `index.ts:114-116` |
| **`/.well-known/oauth-protected-resource`** | **存在しない** | リポジトリ全体 grep で一致なし |

### Server Card の内容 (`apps/server/src/server-card.ts`)

| フィールド | 値 | パス |
| --- | --- | --- |
| `name` / `version` | `"SSW Compass"` / `"2.1.0"` | `server-card.ts:68-69` |
| `capabilities` | `tools:true, resources:true, apps:true, tasks:true, **prompts:false**` | `server-card.ts:79-85` |
| `auth` | `type:"oauth2"`, scopes `["compass:read","compass:draft","compass:approve","compass:execute"]` | `server-card.ts:87-90` |
| `compliance` | `dataResidency:"JP"`, certs `["P-Mark-roadmap"]`, framework `["JP-PIPL","JP-Immigration-Law"]` | `server-card.ts:91-95` |
| `protocolVersions` | `["2025-11-25","2026-07-28"]` (デュアル広告) | `server-card.ts:107` |
| `tools` | 9 ツール名 | `server-card.ts:55-65, 108` |
| `privacyPolicy` / `termsOfService` | ともに `https://mcp.ssw-compass.jp/privacy` | `server-card.ts:105-106` |

**`oauth-protected-resource` の有無 = なし。** RFC 9728 の
`.well-known/oauth-protected-resource` メタデータ文書は未提供。OAuth/スコープ不足時の
誘導は `WWW-Authenticate: Bearer error="insufficient_scope"` ヘッダで実施
(`auth/scopes.ts:48-50`, `index.ts:48-50`) だが、protected-resource メタデータの公開はない。

**計画推定 vs 実態の差分**:
- Server Card は **デュアル広告 (2025-11-25 / 2026-07-28) を実装済み** (`server-card.ts:107`)、
  AGENTS.md の境界要件と一致。
- `capabilities.prompts:false` (Server Card) は MCP `initialize` 広告 (`prompts:{}`) と
  **矛盾** (§2 と同じ指摘)。実態は prompts 提供中なので Server Card 側が古い。
- `oauth-protected-resource` メタデータが未提供 — OAuth ディスカバリの完全性は将来課題。
- `auth.type:"oauth2"` を広告する一方、`ai-plugin.json` は `auth:{type:"none"}` (匿名アクセス)
  で、用途別 (Connector vs OpenAI Apps) の使い分け。

---

## 7. OTel / CI / テストカバレッジ

### OTel

| 観点 | 実態 | パス |
| --- | --- | --- |
| span 生成 | `instrumentTool()` が `tools/call <name>` span を生成 (W3C traceparent 伝播あり) | `apps/server/src/otel.ts:64-109` |
| SDK ブートストラップ | `initOtelSdk()` が `NodeSDK` + `OTLPTraceExporter` を起動 | `apps/server/src/otel-sdk.ts:43-77` |
| 既定状態 | **既定で無効** (`OTEL_SDK_ENABLED=true` か `OTEL_EXPORTER_OTLP_ENDPOINT` 設定時のみ有効) | `otel-sdk.ts:32-36` |
| graceful shutdown 連携 | HTTP drain → OTel flush の順で実行 | `index.ts:360-408` |

### CI ワークフロー (`.github/workflows/`)

| ファイル | 役割 | パス |
| --- | --- | --- |
| `ci.yml` | Biome check + typecheck (turbo 全 9 workspace) + `pnpm -F @ssw/server test` + Terraform fmt/validate | `.github/workflows/ci.yml:16-89` |
| `cd-staging.yml` | staging デプロイ | `.github/workflows/cd-staging.yml` |
| `cd-prod.yml` | prod デプロイ | `.github/workflows/cd-prod.yml` |

- CI トリガ: `pull_request` / `push` to `main` (`ci.yml:3-7`)。`permissions: contents: read`。

### テストカバレッジ実測

- `apps/server` の `test` スクリプトは `vitest run` で、**`--coverage` 等のカバレッジ計測コマンドは
  未設定** (`apps/server/package.json:13`)。よってカバレッジ率の実測値はなし。
- **テスト件数 (実測)**: `pnpm -F @ssw/server test` →
  **Test Files 44 passed (44) / Tests 306 passed (306)** (全緑)。
- **`pnpm test` (workspace 全体, turbo)** → **3 tasks successful / 3 total** (全緑、FULL TURBO cache)。
- RC トランスポートの単体テストも存在 (`apps/server/test/mcp-rc-transport.test.ts`)。

**計画推定 vs 実態の差分**: OTel・CI・テストは整備済み。カバレッジ**率**の計測機構が無い点が
ギャップ (件数のみ把握可能)。閾値ゲートを設けたい場合は `vitest --coverage` の導入が必要。

---

## 8. RC 機能の実装状況とデュアル広告の整合性

| RC 機能 | 実装 | パス |
| --- | --- | --- |
| `server/discover` | 実装済み (`protocolVersions:["2025-11-25","2026-07-28"]`, capabilities を返す) | `apps/server/src/index.ts:90-107` |
| ルーティングヘッダ (`Mcp-Method`/`Mcp-Name`) | 実装済み (`validateMcpRoutingHeaders`)。RC 版で `Mcp-Method` 欠落は 400、本体と不一致も 400 | `index.ts:67-88` |
| MRTR (多段承認) | 実装済み (`applyApprovalInputResponse`, 編集ループ上限・CAS・principal 照合) | `apps/server/src/approval/mrtr.ts:126-229` |
| Server Card デュアル広告 | **両版広告 (`["2025-11-25","2026-07-28"]`)** | `server-card.ts:107` |

### `initialize` の RC 非対応クライアントへのフォールバック

- **明示的な `initialize` 分岐コードは index.ts に存在しない**。RC の上乗せ機能
  (`server/discover`・ルーティングヘッダ検証) は `POST /mcp` ハンドラの**前段**で処理し
  (`index.ts:270-279`)、標準 `initialize` は SDK (`McpServer` + `StreamableHTTPServerTransport`)
  の**組み込みネゴシエーション**に委譲される。
- SDK `^1.29` は安定版 `2025-11-25` を既定で申告するため、**RC 非対応クライアントには
  自動的に `2025-11-25` が返る** (= 後方互換フォールバックは SDK ネゴシエーションで成立)。
- すなわち RC `2026-07-28` 機能は「対応クライアントへの後方互換の上乗せ」として layered。
  RC ヘッダを送らない/RC を知らないクライアントは従来どおり安定版で動作する。

**計画推定 vs 実態の差分**:
- `server/discover`・ルーティングヘッダ・MRTR・Server Card デュアル広告は **すべて実装済み**で
  AGENTS.md §3 のデュアル構成方針と整合。
- ただし「`initialize` の RC 分岐ロジック (RC 非対応クライアントへの 2025-11-25 フォールバック)」は
  **専用の自前分岐コードではなく SDK 既定ネゴシエーション依存**である点が、AGENTS.md の文面
  (自前のフォールバック経路があるかのような記述) と実態の微妙な差分。動作要件は満たすが、
  「フォールバック経路 = SDK 委譲」であることを明記しておくべき。

---

## 監査の締め: 計画推定 vs 実態 (残ギャップ一覧)

| タスク | 状態 | 根拠 (実態ベース) |
| --- | --- | --- |
| **T1 構造化出力** | **完了** | 9 ツール全てが `outputSchema` 宣言 + `structuredContent` 返却 (§3) |
| **T5 アノテーション** | **完了** | 4 ヒント + `title` 全ツール宣言、起動時 `validateToolAnnotations` 強制 (`server.ts:80-102`) |
| **T11 iss/aud 検証** | **残** | `token-verifier.ts` は HS256+exp+tier のみ。`iss`/`aud` クレーム自体を読まない (§4) |
| **T8 `/privacy` 完全版** | **残** | `/privacy` はインラインの簡易 text/plain 要約 (`index.ts:226-242`)。完全版は `docs/privacy/` への GitHub リンク参照に留まり、3 言語完全版を直接配信していない |
| **T4 disclaimer テストの定数ロック** | **残** | `disclaimer-injection.test.ts` は「長さ>10」「`moj.go.jp/isa` 含有」「言語別キーワード含有」を検証するのみで、**`DISCLAIMER_BY_LANG` の完全一致 (定数ロック) ではない** (`test/i18n/disclaimer-injection.test.ts:16-42`) |
| Server Card / initialize の prompts 整合 | **要整合** | initialize は `prompts:{}` 広告 + 3 prompt 登録、Server Card は `prompts:false` (§2/§6) |
| `oauth-protected-resource` メタデータ | **未提供** | RFC 9728 文書なし。誘導は `WWW-Authenticate` ヘッダのみ (§6) |
| バージョン文字列の二系統 | **軽微** | serverInfo `1.0.0` vs Server Card `2.1.0` (§1) |
| カバレッジ率計測 | **なし** | `vitest --coverage` 未設定。件数 306/44 のみ (§7) |

### 8 項目サマリ
1. SDK `^1.29.0` / ext-apps `^1.6.0` / zod `^3.23` / Node 22 (CI)。申告は安定版 `2025-11-25`、Server Card は `["2025-11-25","2026-07-28"]` デュアル。
2. Streamable HTTP・**ステートレス** (POST のみ、GET/DELETE は 405)。**`logging` 広告 = NO** (`server.ts:50-56`)。
3. 9 ツール全て `outputSchema` + `title` + 4 ヒント宣言。書込 2 ツールのみ `readOnlyHint:false`、`get_package_status` は照会で `readOnlyHint:true`。
4. `submit_gyoseishoshi_approval` は **記録 (audit+承認遷移) が本体**、ゲートは **署名 JWT クレーム (`tier`/`gyoseishoshi_verified`) 判定** + スコープ二重防御。
5. ウィジェット MIME = `text/html;profile=mcp-app`、`_meta` は ui nested + openai flat の dual-key、CSP は `'unsafe-eval'` 不在、postMessage は ext-apps SDK 経由。
6. `/.well-known/mcp.json` & `mcp-server-card.json` が Server Card を配信。**`oauth-protected-resource` は無し**。
7. OTel は既定無効・env で有効化。CI 3 ワークフロー。テスト **306 passed / 44 files** 全緑、カバレッジ率計測は未設定。
8. RC (server/discover・ルーティングヘッダ・MRTR・デュアル広告) **実装済み**。RC 非対応への `2025-11-25` フォールバックは **SDK 既定ネゴシエーション依存** (自前分岐なし)。

> 免責: 本書は情報提供を目的とした現状監査であり、法律行為・法的助言ではない。

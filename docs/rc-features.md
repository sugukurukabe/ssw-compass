# RC 機能とデュアル構成 — SSW Compass (T10)

> **対象**: `feat/rc-verification-and-card-consistency` ブランチ (main HEAD `51ffedf` から分岐)。
> **種別**: 検証・回帰・文書化。RC 機能の **挙動は変更しない**。Server Card は事実整合 (②③) のみ。
> **境界**: Server Card / `.well-known` / `initialize` 分岐は AGENTS.md の人間レビュー必須境界。
> **最終更新**: 2026-06-26

---

## 0. 目的 / Purpose / Tujuan

MCP 2026-07-28 RC 機能はすでに実装・本番デプロイ済みである。本書は

1. RC のデュアル構成 (安定版 `2025-11-25` を既定申告し、RC `2026-07-28` を上乗せ) の挙動を明文化し、
2. その挙動を回帰テストで固定 (`apps/server/test/rc-verification.test.ts`) し、
3. T0 監査で検出された Server Card の事実不整合のうち **②prompts 過小申告**・**③version 不一致** を是正し、
4. **①`oauth-protected-resource`** は決定待ちで保留する旨

を記録する。本書はコードの挙動を変えず、現状の正本を文書化する。

---

## 1. RC 機能の実装状況 (実態)

| RC 機能 | 実装 | パス |
| --- | --- | --- |
| `server/discover` (上向き discovery) | 実装済み。`protocolVersions:["2025-11-25","2026-07-28"]` と capabilities を返す | `apps/server/src/index.ts` `handleServerDiscover` |
| ルーティングヘッダ (`Mcp-Method` / `Mcp-Name`) | 実装済み。RC 版で `Mcp-Method` 欠落は 400、本体不一致も 400 | `apps/server/src/index.ts` `validateMcpRoutingHeaders` |
| MRTR (多段承認) | 実装済み。編集ループ上限・CAS・principal 照合 | `apps/server/src/approval/mrtr.ts` |
| Server Card デュアル広告 | 実装済み。`protocolVersions:["2025-11-25","2026-07-28"]` | `apps/server/src/server-card.ts` |

`RC_PROTOCOL_VERSION = "2026-07-28"` は `apps/server/src/index.ts` に定数として保持。

---

## 2. デュアル構成と `initialize` フォールバックの仕組み (SDK 依存)

### 2.1 方針

- **既定申告は安定版 `2025-11-25`**。RC `2026-07-28` 機能は **RC 対応クライアントへの後方互換の上乗せ**として提供する。
- **RC 既定切り替えは安定版 (2026-07-28) 公開後に人間が判断**する。それまで既定は `2025-11-25` を保つ。

### 2.2 `initialize` の protocolVersion は SDK 既定ネゴシエーションに委譲される (自前分岐なし)

`apps/server/src/index.ts` には **`initialize` 用の自前フォールバック分岐コードは存在しない**。
標準 `initialize` は `@modelcontextprotocol/sdk ^1.29` の組み込みネゴシエーションに委譲される。
SDK のネゴシエーションは以下のロジックである
(`node_modules/@modelcontextprotocol/sdk/.../server/index.js`):

```js
const requestedVersion = request.params.protocolVersion;
const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
  ? requestedVersion
  : LATEST_PROTOCOL_VERSION; // = "2025-11-25"
```

SDK `^1.29` の `SUPPORTED_PROTOCOL_VERSIONS` は
`["2025-11-25","2025-06-18","2025-03-26","2024-11-05","2024-10-07"]` であり、
**`2026-07-28` (RC) は含まれない**。したがって:

- `initialize` の `protocolVersion` では **常に最大でも `2025-11-25` までしか交渉されない**。
- RC `2026-07-28` 機能は `server/discover` + ルーティングヘッダの **上乗せ**として提供され、
  `initialize` の `protocolVersion` 経由では交渉されない。

> **重要**: 「RC 非対応クライアントへの 2025-11-25 フォールバック」は、**自前の分岐ではなく
> SDK 既定ネゴシエーションの帰結**である。本タスク (T10) はこの現挙動を回帰テストで固定するに留め、
> フォールバック分岐を新設しない (AGENTS.md の `initialize` 分岐境界を維持)。

### 2.3 互換マトリクス (現挙動)

| クライアント種別 | `initialize` 要求 protocolVersion | `initialize` が返す protocolVersion | RC 上乗せ (`server/discover`・ルーティングヘッダ) |
| --- | --- | --- | --- |
| RC 非対応 (安定版) | `2025-11-25` | `2025-11-25` (echo) | 使わない |
| RC 非対応 (旧版) | `2025-06-18` 等 (SDK supported) | 同値を echo | 使わない |
| RC 対応 | `2026-07-28` | **`2025-11-25` (SDK が LATEST にフォールバック)** | `server/discover` で両版を確認し、`Mcp-Method`/`Mcp-Name` を付与 |
| 不明な版 | SDK 非対応の任意値 | `2025-11-25` (LATEST) | — |

回帰テスト: `apps/server/test/rc-verification.test.ts`
「initialize negotiation (SDK-default fallback, current behavior locked)」。

---

## 3. デュアル広告の整合 (server/discover ↔ Server Card ↔ `.well-known`)

3 経路が矛盾しないことをテストで固定する。

| 申告経路 | protocolVersions | serverInfo.version | prompts |
| --- | --- | --- | --- |
| `initialize` (SDK) | — (§2 の通り negotiated) | `2.1.0` | capabilities に `prompts` あり |
| `server/discover` (`index.ts`) | `["2025-11-25","2026-07-28"]` | `2.1.0` | `capabilities.prompts: {}` |
| Server Card (`server-card.ts` / `.well-known/mcp.json` / `mcp-server-card.json`) | `["2025-11-25","2026-07-28"]` | `2.1.0` | `capabilities.prompts: true` |

回帰テスト: 同ファイル
「dual advertisement consistency」。`.well-known/mcp.json` と `mcp-server-card.json` は
同一の Server Card を配信する (deep-equal を検証)。

---

## 4. ステートレス (隠れ状態なし)

- **Streamable HTTP / ステートレス** (`sessionIdGenerator: undefined`)。リクエスト毎に
  server + transport を生成し、`mcp-session-id` を発行しない。
- `POST /mcp` のみ受理。`GET /mcp` / `DELETE /mcp` は **405 Method Not Allowed** (`Allow: POST`)。
- 各 POST は自己完結 (Cloud Run の水平スケールで別インスタンスに着弾しても動作する)。

回帰テスト: 同ファイル「stateless transport (no hidden per-connection state)」。

---

## 5. キャッシュ metadata (`ttlMs` / `cacheScope`) の付与状況

`apps/server/src/cache.ts` が `withCacheMeta` / `CACHE_TIERS` を提供し、ツール応答の `_meta` に
`ttlMs` / `cacheScope` (必要に応じ `cacheGeneration`) を付与する。

| Tier | `ttlMs` | `cacheScope` | 用途 |
| --- | --- | --- | --- |
| `A_PUBLIC_DAY` | 86,400,000 (1 日) | `public` | 安定した公開情報 |
| `B_PUBLIC_HOUR` | 3,600,000 (1 時間) | `public` | 分野別など変動しうる公開情報 |
| `C_PRIVATE_NO_STORE` | 0 | `private` | 個別判定・no-store |

付与状況 (`rg "withCacheMeta" apps/server/src` 時点):

| ツール | 付与 | 代表 tier |
| --- | --- | --- |
| `search_visa` | あり | `A_PUBLIC_DAY` |
| `classify_procedure` | あり | `C_PRIVATE_NO_STORE` |
| `get_deadline_timeline` | あり | `C_PRIVATE_NO_STORE` |
| `list_visa_documents` | あり | `A_PUBLIC_DAY` / `B_PUBLIC_HOUR` (industry 指定時) |
| `validate_zairyu_compatibility` | あり | `C_PRIVATE_NO_STORE` |
| `list_law_updates` | あり | `B_PUBLIC_HOUR` (+ `cacheGeneration`) |
| `get_package_status` | あり | `C_PRIVATE_NO_STORE` |
| `submit_gyoseishoshi_approval` | なし (書込・監査記録) | — |
| `prepare_document_package` | なし (書込・署名 URL 生成) | — |

回帰テスト: 同ファイル「cache tier invariants」+ 既存 `apps/server/test/cache.test.ts`。

---

## 6. Server Card 事実整合 (T10-B / 本タスクで反映した ②③)

T0 監査 (`docs/audit-current-state.md`) と提案書 (`docs/well-known-reconciliation-proposal.md`)
で検出された 3 点のうち、**②③ のみ**を本タスクで反映した。

### ② prompts 過小申告の是正 (反映済み)

- 実態: `initialize` / `server/discover` が `prompts:{}` を広告し、`registerWorkflowPrompts` が
  3 prompt (`ssw_new_staff_intake_check` / `ssw_route_and_documents` / `ssw_notification_deadlines`)
  を登録済み。
- 不整合: Server Card のみ `capabilities.prompts: false` (過小申告)。
- 是正: Server Card を `capabilities.prompts: true` に整合 (`apps/server/src/server-card.ts`)。

### ③ version 不一致の統一 (反映済み・方針 X)

- 不整合: `serverInfo.version` `1.0.0` (server.ts / server/discover / package.json) vs
  Server Card `version` `2.1.0`。
- 是正: **製品現行版 `2.1.0` に統一** (提案書の方針 X)。
  - `apps/server/src/server.ts` `SERVER_INFO.version` → `2.1.0`
  - `apps/server/src/index.ts` `server/discover` `serverInfo.version` → `2.1.0`
  - `apps/server/package.json` `version` → `2.1.0`
- 理由: 多くの公開ディレクトリ審査が `serverInfo.version` と Server Card `version` の一致を期待する。
- **`openapi.json` の `info.version` (`4.0.0`) は別管理**: これは OpenAI Apps SDK 提出用 OpenAPI
  ドキュメントの版であり、MCP サーバー実装版 (serverInfo) とは役割が異なるため統一対象外。

### ① `oauth-protected-resource` (RFC 9728) は保留 (本タスクでは実装しない)

- 状態: **決定待ち (人間判断)**。公開審査 (OpenAI Apps / Anthropic Connectors) に OAuth フローを
  含めるか、含めるなら認可サーバー (IdP issuer URL) を確定する必要があるため。
- 現状: 匿名 Free は OAuth 不要で 6 読み取りツールを利用できる。OAuth は Pro/Business の
  `compass:draft` / `compass:approve` step-up にのみ必要。スコープ不足時の誘導は
  `WWW-Authenticate` ヘッダで実施 (`apps/server/src/auth/scopes.ts`)。
- 判断材料と差分案は `docs/well-known-reconciliation-proposal.md` §2 を参照。
  issuer 確定後に別タスクで実装する。

---

## 7. 不変を維持した境界 (本タスクで触れていない)

- `initialize` の RC フォールバック挙動 (SDK 委譲) は **変更しない**。現挙動を回帰テストで固定するのみ。
- Server Card のデュアル広告 (`protocolVersions:["2025-11-25","2026-07-28"]`) は維持。
- `logging` capability は引き続き **不広告** (ステートレス + WORM 監査が正本)。
- `oauth-protected-resource` / `WWW-Authenticate` の `resource_metadata` は **未実装のまま** (① 保留)。

---

> 免責: 本書は情報提供を目的とした現状文書であり、法律行為・法的助言ではない。

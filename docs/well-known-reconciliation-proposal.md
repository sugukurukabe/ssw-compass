# `.well-known` / Server Card 整合 提案書（T8-B）

> **種別**: 提案のみ（PROPOSAL ONLY）。本書はコードを変更しない。
> **境界**: `.well-known/` と Server Card は AGENTS.md の人間レビュー必須境界。
> 反映は人間承認後に **別タスク T10** で行う。
> **対象コミット**: `main` HEAD `c32eb1f` 時点の実装。
> **最終更新**: 2026-06-26

---

## 0. 目的 / Purpose / Tujuan

T0 監査で検出された `.well-known` / Server Card の 3 つの不整合について、
具体的な before/after 差分案と論点を提示し、**人間（CEO / 行政書士 / プロトコル責任者）の判断**を仰ぐ。
本書は提案であり、コードへの反映は行わない。

検出された不整合:
1. `oauth-protected-resource`（RFC 9728）が未提供。
2. prompts capability の **過小申告**（Server Card `prompts:false` だが initialize / server/discover は `prompts:{}` を広告し 3 prompt を登録済み）。
3. **version 不整合**（`serverInfo.version` `1.0.0` vs Server Card `version` `2.1.0`）。

---

## 1. 現状の `.well-known` エンドポイント実態

`apps/server/src/index.ts` が配信:

| パス | 内容 | 出典 |
|---|---|---|
| `/.well-known/ai-plugin.json` | OpenAI Apps SDK manifest（`auth.type: "none"`） | インライン |
| `/.well-known/openapi.json` | 最小 OpenAPI 3.1 | インライン |
| `/.well-known/mcp.json` | Server Card | `buildServerCard()` |
| `/.well-known/mcp-server-card.json` | Server Card（同上のエイリアス） | `buildServerCard()` |

**未提供**: `/.well-known/oauth-protected-resource`、`/.well-known/oauth-authorization-server`。

`POST /mcp` の `server/discover`（`handleServerDiscover`）と Server Card（`buildServerCard`）で
申告内容に差がある。以下で 3 点を個別に扱う。

---

## 2. 論点 A — `oauth-protected-resource`（RFC 9728）の要否

### 2.1 背景

- MCP Authorization 仕様は、保護対象 MCP サーバーが **`WWW-Authenticate` に `resource_metadata`** を返し、
  `/.well-known/oauth-protected-resource` で認可サーバー（`authorization_servers`）を案内することを求める。
- 現状の `buildWwwAuthenticate`（`apps/server/src/auth/scopes.ts`）は
  `Bearer error="insufficient_scope", scope="...", error_description="..."` を返すが、
  **`resource_metadata` を含まない**。`/.well-known/oauth-protected-resource` も未提供。
- 一方、サービスは「公開・匿名・読み取り中心」。匿名 Free は OAuth 不要で全 6 読み取りツールを使える。
  OAuth は Pro/Business の `compass:draft` / `compass:approve` step-up にのみ必要。

### 2.2 要否は「公開審査に OAuth を出すか」に依存（人間判断事項）

| 判断 | 結論 | 必要対応 |
|---|---|---|
| **(I)** 公開審査では匿名読み取りのみを提示し、OAuth/Pro は内部限定 | `oauth-protected-resource` は**不要**。`ai-plugin.json` の `auth.type:"none"` と整合 | 追加なし。Server Card の `auth.type` を後述の通り見直すか要検討 |
| **(II)** 公開審査の時点で OAuth 保護リソースとして登録（MCP クライアントの自動 OAuth 探索を有効化） | `oauth-protected-resource` の提供が**必要**。`WWW-Authenticate` に `resource_metadata` 追加も必要 | §2.3 の新規エンドポイント追加 + 認可サーバー（IdP）確定 |

> **人間判断 1**: 公開審査（OpenAI Apps / Anthropic Connectors）に **OAuth フローを含めるか**。
> 含めるなら認可サーバー（issuer URL / IdP）を確定する必要がある（現状の `token-verifier` の issuer 設定と一致させる）。

### 2.3 (II) を選ぶ場合の追加案（提案・未実装）

新規エンドポイント（`index.ts` に追加する想定。**T10 で実装**）:

```jsonc
// GET /.well-known/oauth-protected-resource  (RFC 9728)
{
  "resource": "https://mcp.ssw-compass.jp/mcp",
  "authorization_servers": ["<IdP issuer URL を確定>"],
  "scopes_supported": ["compass:read", "compass:draft", "compass:approve", "compass:execute"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://mcp.ssw-compass.jp/privacy"
}
```

`WWW-Authenticate` 提案差分（`auth/scopes.ts`、**未実装**）:

```diff
 export function buildWwwAuthenticate(scope: CompassScope): string {
-  return `Bearer error="insufficient_scope", scope="${scope}", error_description="Additional SSW Compass consent is required"`;
+  return (
+    `Bearer error="insufficient_scope", scope="${scope}", ` +
+    `error_description="Additional SSW Compass consent is required", ` +
+    `resource_metadata="https://mcp.ssw-compass.jp/.well-known/oauth-protected-resource"`
+  );
 }
```

> **注**: `authorization_servers` の issuer を確定できるまで実装しない。誤った issuer 公開は探索失敗を招く。

---

## 3. 論点 B — prompts capability の過小申告

### 3.1 事実

- `apps/server/src/server.ts`：`createMcpServer` は `capabilities.prompts: {}` を宣言し、
  `registerWorkflowPrompts` が **3 prompt** を登録（`ssw_new_staff_intake_check` /
  `ssw_route_and_documents` / `ssw_notification_deadlines`）。
- `apps/server/src/index.ts`：`server/discover` の応答も `capabilities: { tools:{}, resources:{}, prompts:{} }`。
- `apps/server/src/server-card.ts`：Server Card の `capabilities.prompts` は **`false`**。

→ 実機能（prompts 提供あり）に対し、Server Card のみ `false`。**過小申告**で、
カタログ/ディレクトリ側が prompts を非表示にする恐れ。

### 3.2 提案差分（Server Card、**未実装**・人間承認後 T10）

```diff
 // apps/server/src/server-card.ts
   capabilities: {
     tools: true,
     resources: true,
     apps: true,
     tasks: true,
-    prompts: false,
+    prompts: true,
   },
```

> **整合先**: `server/discover` / initialize が `prompts:{}` を広告し 3 prompt を登録している実態と一致させる。
> **人間判断 2**: prompts を公開機能として正式に露出してよいか（社内ワークフロー prompt を公開ディレクトリに見せる是非）。
> 露出を望まないなら、逆に **prompts 登録側を絞る**選択もある（その場合は server.ts / workflows.ts 側の変更となり別途検討）。

---

## 4. 論点 C — version 不整合

### 4.1 事実

| 箇所 | フィールド | 値 |
|---|---|---|
| `apps/server/src/server.ts` `SERVER_INFO` | `version` | `1.0.0` |
| `apps/server/src/index.ts` `server/discover` `serverInfo` | `version` | `1.0.0` |
| `apps/server/package.json` | `version` | `1.0.0` |
| `apps/server/src/server-card.ts` `SERVER_CARD` | `version` | `2.1.0` |
| `apps/server/src/index.ts` `openapi.json` `info` | `version` | `4.0.0` |

→ `serverInfo`（MCP プロトコル上のサーバー実装バージョン）と Server Card / OpenAPI の
プロダクトバージョンが三者三様。クライアントによっては `serverInfo.version` と
Server Card `version` の不一致を検証エラー扱いにする。

### 4.2 提案（方針案・人間承認後 T10）

2 つの解決方針。**どちらを正とするかは人間判断**。

- **方針 X（単一バージョンに統一）**: `serverInfo` / Server Card / package.json をすべて一致させる。
  例: プロダクト現行 `2.1.0` に揃える。

```diff
 // apps/server/src/server.ts
 const SERVER_INFO = {
   name: "ssw-mcp",
-  version: "1.0.0",
+  version: "2.1.0",
 } as const;
```

```diff
 // apps/server/src/index.ts  (server/discover)
-      serverInfo: { name: "ssw-mcp", version: "1.0.0" },
+      serverInfo: { name: "ssw-mcp", version: "2.1.0" },
```

（`package.json` の `version` も `2.1.0` に更新。`openapi.json` の `info.version` の扱いは別途。）

- **方針 Y（意味を分離して明文化）**: `serverInfo.version` = 実装/プロトコル実装版、
  Server Card `version` = プロダクト版、と役割を分けることを **ドキュメントで明記**し、
  バージョン番号自体は変えない（ただしクライアント検証リスクは残る）。

> **人間判断 3**: 「単一バージョン統一（X）」か「役割分離の明文化（Y）」か。
> 公開ディレクトリの審査要件次第（多くは serverInfo と Server Card の一致を期待）。推奨は **方針 X**。

---

## 5. まとめ（人間が決めること）

| # | 論点 | 決定事項 | 既定の推奨 |
|---|---|---|---|
| 1 | `oauth-protected-resource` | 公開審査に OAuth を含めるか。含めるなら IdP issuer 確定 | 審査要件を確認後に決定（現状は (I) で開始可） |
| 2 | prompts capability | Server Card を `prompts:true` に揃えるか（露出可否） | 露出可なら `true` に統一 |
| 3 | version 不整合 | 単一統一（X）か役割分離明文化（Y）か | 方針 X（`2.1.0` 統一） |

承認後、上記差分を **T10** で `.well-known` / Server Card に反映する。

---

## 6. 反映禁止事項（本書での非対象）

- 本書はコードを変更しない（`.well-known` / Server Card / `auth/scopes.ts` は無変更）。
- Server Card のデュアル広告（`protocolVersions: ["2025-11-25","2026-07-28"]`）は維持（AGENTS.md 境界）。
- `initialize` の RC フォールバック分岐、`logging` 不広告も維持。

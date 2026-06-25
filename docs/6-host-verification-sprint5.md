# 6-Host Verification — Sprint 5 (mcp.ssw-compass.jp 本番URL)

> **Sprint 4 G3** の残課題。prod URL が確定したため Sprint 5 で実施。
> **必須**: Claude Desktop + Claude Web の 2 host (Sprint 4 G3 gating)
> **Stretch**: VS Code Copilot / Goose / Postman / MCPJam

---

## 事前準備 (全 host 共通)

prod は `allow_unauthenticated=true` + `SSW_AUTH_MODE=jwt` で公開済み。
ツール接続 URL: **`https://mcp.ssw-compass.jp/mcp`** (認証不要 = Free tier)

---

## Host 1: Claude Desktop (必須)

### 設定

`~/Library/Application Support/Claude/claude_desktop_config.json` を以下に設定:

```json
{
  "mcpServers": {
    "ssw-compass": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.ssw-compass.jp/mcp"
      ]
    }
  }
}
```

### チェックリスト

- [ ] Claude Desktop 再起動後、SSW Compass が MCP ツールとして認識される
- [ ] 「特定技能1号 建設分野の更新手続を教えて」→ search_visa が実行され disclaimer が表示
- [ ] UI Resource (skeleton → 実データ fade-in) が正常表示
- [ ] 「外食業の制度変更フィードを教えて」→ list_law_updates が返る
- [ ] disclaimer フッターが日本語で表示されている
- [ ] PII (在留カード番号など) を含む質問でブロックされる

### 確認 screenshot 保存先

`assets/screenshots/claude-desktop-*.png`

---

## Host 2: Claude Web Custom Connector (必須)

### 設定

1. https://claude.ai → 設定 → Feature Preview → Custom Connectors
2. 「Add Custom Connector」
3. Name: `SSW Compass Japan`
4. URL: `https://mcp.ssw-compass.jp/mcp`
5. Auth: なし (Free tier = anonymous)

### チェックリスト

- [ ] Connector が追加される
- [ ] 新規チャットで SSW Compass を選択できる
- [ ] search_visa で日本語 disclaimer 付き回答
- [ ] list_law_updates (immigration_act フィルタ) で法改正情報が返る
- [ ] `.well-known/mcp.json` の version が `4.0.0` であること確認

### 確認 screenshot 保存先

`assets/screenshots/claude-web-*.png`

---

## Host 3: VS Code GitHub Copilot (Stretch)

### 設定

`.vscode/mcp.json` (workspace) または User Settings:

```json
{
  "mcp.servers": {
    "ssw-compass": {
      "type": "http",
      "url": "https://mcp.ssw-compass.jp/mcp"
    }
  }
}
```

### チェックリスト

- [ ] Copilot Chat で `#ssw-compass` が使える
- [ ] search_visa が実行される
- [ ] エラーなく回答が返る

---

## Host 4: Goose (Stretch)

### 設定 (`~/.config/goose/profiles.yaml`)

```yaml
default:
  provider: anthropic
  processor: claude-sonnet-4-5
  extensions:
    - type: http
      name: ssw-compass
      url: https://mcp.ssw-compass.jp/mcp
```

### チェックリスト

- [ ] `goose session start` で SSW Compass が認識される
- [ ] search_visa が実行される

---

## Host 5: Postman MCP (Stretch)

### 設定

1. Postman → MCP Servers → Add Server
2. URL: `https://mcp.ssw-compass.jp/mcp`
3. Type: Streamable HTTP

### チェックリスト

- [ ] tools/list で 9 tools 取得
- [ ] tools/call search_visa で正常レスポンス
- [ ] resources/read ui://ssw-search/mcp-app.html で HTML 取得

---

## Host 6: MCPJam (Stretch)

URL: https://mcpjam.com

### チェックリスト

- [ ] `https://mcp.ssw-compass.jp/mcp` で接続できる
- [ ] tools が一覧に表示される
- [ ] search_visa が実行できる

---

## 結果記録

| Host | 必須/Stretch | tools/list | search_visa | list_law_updates | UI Resource | 結果 |
|---|---|---|---|---|---|---|
| Claude Desktop | 必須 | | | | | |
| Claude Web | 必須 | | | | | |
| VS Code Copilot | Stretch | | | | | |
| Goose | Stretch | | | | | |
| Postman | Stretch | | | | | |
| MCPJam | Stretch | | | | | |

---

## 完了条件

- 必須 2 host (Claude Desktop + Web) がすべて pass → **Sprint 5 G3 達成**
- `assets/screenshots/` に各 host 最低 1 枚のスクリーンショット保存
- `docs/host-verification-report.md` に結果記録 (既存テンプレートを更新)

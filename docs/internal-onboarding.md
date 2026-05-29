# 社内利用ガイド / Internal Onboarding / Panduan Onboarding Internal

スグクル社内のスタッフ (行政書士・派遣担当・支援担当) が SSW Compass を
日常業務で使うための接続・利用手順。

How Sugukuru staff connect to and use SSW Compass for daily work.
Cara staf Sugukuru terhubung dan menggunakan SSW Compass untuk pekerjaan harian.

> 本ガイドは **開発者向けではない**。開発環境構築は [`onboarding.md`](onboarding.md) を参照。

---

## 1. SSW Compass とは / What it is / Apa itu

特定技能 (SSW) ビザ手続の**公式情報源 (出入国在留管理庁 等) に基づく情報**を返す MCP App。

- **読み取り専用・匿名**で利用可能 (Free tier)。
- 6 つの情報ツール: `search_visa` / `classify_procedure` / `get_deadline_timeline` /
  `list_visa_documents` / `list_law_updates` / `validate_zairyu_compatibility`。
- すべての回答に免責事項が付く。**法律相談・行政書士業務には該当しない**。

本番エンドポイント / Production endpoint:

```
https://mcp.ssw-compass.jp/mcp
```

---

## 2. 接続方法 / How to connect / Cara menghubungkan

### 2-1. Claude Web (推奨 / 最も簡単)

1. Claude (<https://claude.ai>) にログイン。
2. Settings → Connectors → **Add custom connector**。
3. URL に `https://mcp.ssw-compass.jp/mcp` を入力して保存。
4. 新しいチャットで SSW Compass を有効化して質問する。

認証不要 (Free tier, 匿名)。個人情報は入力しないこと (後述)。

### 2-2. Claude Desktop

`claude_desktop_config.json` に以下を追記する
(サンプル: [`.claude/desktop_config.example.json`](../.claude/desktop_config.example.json))。

```json
{
  "mcpServers": {
    "ssw-compass": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.ssw-compass.jp/mcp"]
    }
  }
}
```

設定ファイルの場所:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

編集後、Claude Desktop を再起動する。

### 2-3. その他のホスト / Other hosts

VS Code (GitHub Copilot) / Goose / Postman / MCPJam なども
`https://mcp.ssw-compass.jp/mcp` を Streamable HTTP MCP として追加できる。

---

## 3. 使い方の例 / Usage examples / Contoh penggunaan

社内でよく使うプロンプト例 (日本語):

1. `技能実習2号から特定技能1号・農業へ変更したい。どの申請で、どの表が必要？`
2. `特定技能1号・農業で必要書類チェックリストを見せて。省略できる書類も分けて`
3. `特定技能1号の更新期限を2026年7月基準で確認して`
4. `特定技能に関する最近の制度変更を教えて`
5. `留学ビザの人を農業でフルタイム雇用してよいか確認して`

英語・インドネシア語でも質問可能 (ja/en/id は公式情報源での grounding 対応)。

---

## 4. 個人情報の取り扱い (厳守) / PII handling / Penanganan PII

**在留カード番号・パスポート番号・マイナンバー等の個人情報を入力しないこと。**
入力すると自動でブロックされ、回答できない。

- 年月のみ可 (例: 在留期限「2026年7月」)。氏名・生年月日 (日付) は入力しない。
- これはサービス側の PII ガードで強制されるが、運用側でも徹底する。

Do NOT enter personal identifiers (residence card number, passport number, My Number).
Jangan memasukkan pengenal pribadi (nomor kartu izin tinggal, paspor, My Number).

---

## 5. Pro tier (L2 機能) / Pro tier / Tier Pro

`submit_gyoseishoshi_approval` (行政書士の承認記録) は **Pro tier + 行政書士認証**が必要な
L2 機能。Free (匿名) では H01 ロックゲートで拒否され、アップグレード案内が返る。

### 5-1. JWT 発行 (管理者: 壁のみ)

Pro tier トークンは Secret Manager の `ssw-jwt-secret` を使って発行する。

```bash
# 前提: gcloud 認証済み + ssw-jwt-secret への閲覧権限
pnpm tsx scripts/issue-jwt.ts \
  --sub "staff-yamada" \
  --tier pro \
  --gyoseishoshi-verified \
  --gyoseishoshi-number "東京都 12345" \
  --expires 90d
```

出力された JWT を対象スタッフに安全な経路 (社内パスワードマネージャ等) で共有する。
**JWT を Slack 等に平文で貼らないこと。**

### 5-2. JWT を使った接続 (Claude Desktop)

`mcp-remote` の `--header` で Authorization ヘッダを付与する:

```json
{
  "mcpServers": {
    "ssw-compass-pro": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.ssw-compass.jp/mcp",
        "--header",
        "Authorization: Bearer <発行されたJWT>"
      ]
    }
  }
}
```

トークンは既定で 90 日で失効する。失効したら 5-1 で再発行する。

---

## 6. データの鮮度 / Data freshness / Kesegaran data

- 検索系ツールは出入国在留管理庁等の**公式情報源**に grounding している。
- 制度変動 (`list_law_updates`) は応答に「データ最終確認日」を表示する。
  更新運用は [`law-updates-maintenance-runbook.md`](law-updates-maintenance-runbook.md)。
- 公式 URL の死活は `pnpm check:url-health` で定期確認する
  ([`rag-pipeline-runbook.md`](rag-pipeline-runbook.md) §1b)。

---

## 7. トラブルシューティング / Troubleshooting / Pemecahan masalah

| 症状 | 対処 |
|---|---|
| 接続できない | URL が `https://mcp.ssw-compass.jp/mcp` (末尾 `/mcp`) か確認 |
| 「個人情報は入力できません」と返る | 在留番号・パスポート番号等を入力していないか確認 (§4) |
| Pro 機能が「Pro 以上の…」で拒否される | JWT が未設定/失効 (§5)。管理者に再発行を依頼 |
| 結果が「見つかりませんでした」 | 分野や申請種別を具体化して再質問。公式サイトも案内される |
| widget が表示されない | ホストが MCP App UI 非対応の可能性。テキスト回答は表示される |

問い合わせ先: a_kabe@sugu-kuru.co.jp

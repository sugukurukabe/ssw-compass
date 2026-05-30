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

## 4. 新人向け標準フロー / New staff workflow / Alur staf baru

新人は、いきなり「必要書類を教えて」と聞くより、以下の順番で確認する。
この順番にすると、申請種別・期限・就労可否の見落としが減る。

New staff should follow this order instead of jumping directly to document lists.
Staf baru sebaiknya mengikuti urutan ini, bukan langsung meminta daftar dokumen.

### 4-1. 最初の5分チェック / First 5-minute check / Pemeriksaan 5 menit pertama

1. **現在地を確認する**  
   現在の在留資格、海外/国内、希望分野、希望業務を確認する。氏名・在留カード番号は入力しない。

2. **申請種別を判定する**  
   `classify_procedure` で「認定 / 変更 / 更新」のどれかを確認する。

3. **必要書類を確認する**  
   `list_visa_documents` で第1表・第2表・第3表、分野別書類、省略候補を確認する。

4. **期限を確認する**  
   `get_deadline_timeline` で更新申請、随時届出、定期届出の期限を確認する。

5. **就労リスクを確認する**  
   `validate_zairyu_compatibility` で在留資格と業務内容の不一致、不法就労リスクを確認する。

6. **最後に人が確認する**  
   SSW Compass は一般情報。個別案件の最終判断は行政書士・責任者が行う。

### 4-2. 新人用そのまま使える質問 / Copy-paste prompts / Prompt siap pakai

#### 申請種別を確認したい

```text
技能実習2号から特定技能1号・農業へ変更したい候補者がいます。
個人情報は入力しません。
どの申請種別になり、最初に確認すべき条件・必要な表・注意点を順番に教えてください。
```

#### 必要書類を確認したい

```text
特定技能1号・農業の在留資格変更で必要書類を確認したいです。
第1表・第2表・第3表、分野別書類、省略できる可能性がある書類を分けて教えてください。
```

#### 期限を確認したい

```text
特定技能1号の更新期限と届出期限を確認したいです。
基準年月は2026年7月です。
更新申請、随時届出、定期届出を分けて、社内で次に何をすべきか教えてください。
```

#### 就労できるか確認したい

```text
留学の在留資格の人を農業でフルタイム雇用してよいか確認したいです。
個人情報は入力しません。
不法就労リスク、確認すべき許可、行政書士に確認すべき点を教えてください。
```

#### 制度変更を確認したい

```text
特定技能に関する最近の制度変更を、派遣会社の担当者向けに教えてください。
受入企業、人材派遣、登録支援機関に影響するものを分けてください。
```

### 4-3. 回答の読み方 / How to read answers / Cara membaca jawaban

- **公式情報源リンク**: まず `*.go.jp` のリンクを開く。社内判断の根拠にする。
- **confidence**: 低い場合は追加確認する。高くても個別案件の最終判断にはしない。
- **disclaimer**: 必ず読む。回答は一般情報で、法律相談ではない。
- **「見つかりませんでした」**: 質問を具体化する。分野・申請種別・年月を入れる。
- **WARNING / ILLEGAL**: すぐに責任者・行政書士へエスカレーションする。

### 4-4. エスカレーション基準 / Escalation rules / Aturan eskalasi

次のいずれかに当てはまる場合、新人だけで判断しない。

- 在留資格と予定業務が一致しているか不明。
- 留学・家族滞在・短期滞在など、就労制限がありそうな在留資格。
- 在留期限まで30日未満。
- 申請中に新しい受入先で働けるか、本人が急いでいる。
- 技能実習の職種・作業と特定技能分野の対応が不明。
- 書類省略を使ってよいか不明。
- 企業が初めて特定技能を受け入れる。
- 回答に `WARNING` / `ILLEGAL` / `行政書士に確認` が出た。

---

## 5. 個人情報の取り扱い (厳守) / PII handling / Penanganan PII

**在留カード番号・パスポート番号・マイナンバー等の個人情報を入力しないこと。**
入力すると自動でブロックされ、回答できない。

- 年月のみ可 (例: 在留期限「2026年7月」)。氏名・生年月日 (日付) は入力しない。
- 入力してよい例: `特定技能1号・農業・更新・2026年7月基準`
- 入力してはいけない例: 氏名、在留カード番号、パスポート番号、My Number、顔写真、住所、電話番号。
- これはサービス側の PII ガードで強制されるが、運用側でも徹底する。

Do NOT enter personal identifiers (residence card number, passport number, My Number).
Jangan memasukkan pengenal pribadi (nomor kartu izin tinggal, paspor, My Number).

---

## 6. Pro tier (L2 機能) / Pro tier / Tier Pro

`submit_gyoseishoshi_approval` (行政書士の承認記録) は **Pro tier + 行政書士認証**が必要な
L2 機能。Free (匿名) では H01 ロックゲートで拒否され、アップグレード案内が返る。

### 6-1. JWT 発行 (管理者: 壁のみ)

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

### 6-2. JWT を使った接続 (Claude Desktop)

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

## 7. 社内での使い分け / Internal usage roles / Pembagian penggunaan internal

| 役割 | 主な使い方 | 注意 |
|---|---|---|
| 新人・派遣担当 | 申請種別、必要書類、期限の一次確認 | 個別判断を確定しない |
| 登録支援担当 | 届出期限、支援計画変更、定期届出の確認 | 14日以内の随時届出を見落とさない |
| 行政書士・責任者 | SSW Compass の結果を根拠確認に使う | 最終判断と書類承認は人が行う |
| 開発/運用 | URL health、データ鮮度、接続監視 | 本番 URL と privacy endpoint を維持 |

---

## 8. データの鮮度 / Data freshness / Kesegaran data

- 検索系ツールは出入国在留管理庁等の**公式情報源**に grounding している。
- 制度変動 (`list_law_updates`) は応答に「データ最終確認日」を表示する。
  更新運用は [`law-updates-maintenance-runbook.md`](law-updates-maintenance-runbook.md)。
- 公式 URL の死活は `pnpm check:url-health` で定期確認する
  ([`rag-pipeline-runbook.md`](rag-pipeline-runbook.md) §1b)。

---

## 9. トラブルシューティング / Troubleshooting / Pemecahan masalah

| 症状 | 対処 |
|---|---|
| 接続できない | URL が `https://mcp.ssw-compass.jp/mcp` (末尾 `/mcp`) か確認 |
| ツールが読み込めない | コネクタを削除して再追加。URL は `/mcp` まで入れる。 |
| 「個人情報は入力できません」と返る | 在留番号・パスポート番号等を入力していないか確認 (§5) |
| Pro 機能が「Pro 以上の…」で拒否される | JWT が未設定/失効 (§6)。管理者に再発行を依頼 |
| 結果が「見つかりませんでした」 | 分野や申請種別を具体化して再質問。公式サイトも案内される |
| widget が表示されない | ホストが MCP App UI 非対応の可能性。テキスト回答は表示される |
| 回答が判断しきれない | `4-4. エスカレーション基準` に該当するか確認し、責任者へ回す |

問い合わせ先: a_kabe@sugu-kuru.co.jp

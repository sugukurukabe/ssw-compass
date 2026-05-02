# Anthropic Connectors Directory 提出パケット

> **提出アカウント**: a_kabe@sugu-kuru.co.jp
> **提出予定**: Demo video / privacy check / host verification 完了後
> **前提条件**: A1(logo)✅ A2(screenshots)✅ A3(video)🔜 A4(privacy)🔜 A5(license)✅

---

## Server Card (/.well-known/mcp.json) 確認

```
GET https://mcp.ssw-compass.jp/.well-known/mcp.json
```

現在の値:
- `name`: SSW Compass
- `version`: 4.0.0
- `description`: Official-source-grounded informational app for Japanese specified-skilled-worker (SSW / 特定技能) and related visa procedures. Read-only tools cover search, procedure classification, deadlines, document checklists, law updates, and zairyu compatibility. Information only — not legal advice.
- `publisher.name`: スグクル株式会社
- `publisher.url`: https://mcp.ssw-compass.jp
- `auth.type`: none (anonymous read-only connector)
- `license`: Apache-2.0
- `privacyPolicy`: https://mcp.ssw-compass.jp/privacy
- `categories`: ["regulated-industry", "immigration", "japan", "informational"]

---

## Anthropic Connectors Directory 提出フォーム

### 基本情報

| フィールド | 値 |
|---|---|
| **Connector name** | SSW Compass Japan |
| **Tagline (≤ 80 chars)** | The compass for Japanese visa procedures. Official sources, 10 languages. |
| **Description (≤ 400 chars)** | SSW Compass grounds Japanese Specified Skilled Worker (特定技能) visa questions in 出入国在留管理庁 official documents. 6 read-only tools cover search, procedure classification, deadlines, document checklists, law updates, and zairyu compatibility. Information only — no legal advice. |
| **Categories** | Legal & Compliance, Language & Communication, Productivity |
| **Homepage URL** | https://mcp.ssw-compass.jp |
| **Privacy Policy URL** | https://mcp.ssw-compass.jp/privacy |
| **Terms of Service URL** | https://mcp.ssw-compass.jp/privacy |
| **License** | Apache-2.0 |
| **Allowed link URIs** | https://www.moj.go.jp, https://www.mhlw.go.jp, https://www.mlit.go.jp, https://www.maff.go.jp |

### ターゲットユーザー

- 特定技能外国人受入企業の HR 担当者
- 登録支援機関のスタッフ
- 特定技能外国人本人 (10言語対応)

### 提供ツール (6 read-only tools)

| Tool | Level | 説明 |
|---|---|---|
| `search_visa` | Free | 特定技能・関連ビザの情報検索 (10言語) |
| `classify_procedure` | Free | 申請種別の自動判定 |
| `get_deadline_timeline` | Free | 在留期限タイムライン (Free 3名制限) |
| `list_visa_documents` | Free | 必要書類チェックリスト |
| `list_law_updates` | Free | 制度変動フィード |
| `validate_zairyu_compatibility` | Free | 在留資格×業務適合性判定 (H06 不法就労アラート) |

### セキュリティ・コンプライアンス

- PII 自動ブロック: 在留カード番号・パスポート番号・マイナンバー
- Cloud DLP 2nd stage (LIKELY threshold)
- 出力サニタイザー (indirect prompt injection 対策)
- Cloud Armor WAF + Global LB
- 越境移転なし (asia-northeast1 のみ)
- MCP Apps の外部リンクは原則 `go.jp` 公式 URL に限定。試験実施団体は省庁リンク済みの delegated official source として catalog metadata で区別。

---

## OpenAI Apps SDK 提出 (A7)

### Plugin Manifest (`/.well-known/ai-plugin.json`)

Sprint 5 後半で追加予定。基本情報は Anthropic と同一。

| フィールド | 値 |
|---|---|
| `name_for_human` | SSW Compass Japan |
| `name_for_model` | ssw_compass_japan |
| `description_for_human` | Official-source visa information for Japanese Specified Skilled Worker (特定技能) procedures |
| `description_for_model` | Tool for querying Japanese SSW visa procedures grounded in 出入国在留管理庁 official documents. Returns 6 read-only tools for search, classify, deadline, documents, law_updates, and zairyu compatibility. Information only, not legal advice. |
| `auth.type` | none |
| `api.type` | openapi |
| `contact_email` | a_kabe@sugu-kuru.co.jp |

---

## 提出前チェックリスト

### 技術要件

- [x] `/.well-known/mcp.json` でサービスが発見可能
- [x] HTTPS 有効 (Google-managed cert ACTIVE)
- [x] `allow_unauthenticated=true` (anonymous アクセス可能)
- [x] health check が 200 を返す
- [x] 全 tools が tools/list に表示される
- [x] disclaimer が全レスポンスに含まれる
- [x] Vertex real mode (`visa_legal_core_v2` 139 docs, `visa_forms_v2` 118 docs imported; prod smoke returns source-index URLs)
- [x] `/.well-known/ai-plugin.json` returns 200 JSON
- [x] `/.well-known/openapi.json` returns 200 JSON
- [x] Internal helper `_ssw_checklist_schema` removed from public tools/list
- [x] MCP tools/resources/prompts smoke passes, including catalog resources

### コンテンツ要件

- [ ] プライバシーポリシー最終確認済み (A4 完了後)
- [ ] ロゴ PNG ≥ 512×512 (A1 ✅: icon-512.png)
- [x] スクリーンショット × 5 (A2 ✅: `docs/screenshots/*.png`, 1200px width)
- [ ] デモ動画 ≤ 120 秒 (A3)
- [x] ライセンス明示 (A5 ✅: Apache-2.0)

### Screenshot prompts (Anthropic MCP Apps carousel)

Anthropic requires 3-5 PNG screenshots, width ≥ 1000px, cropped to app response only.
Use these paired prompt texts:

| Screenshot | Prompt | Tool / UI |
|---|---|---|
| 1 | `技能実習2号から特定技能1号・農業へ変更したい。どの申請で、どの表が必要？` | `classify_procedure` / 4-step classifier UI with technical-intern field-mapping warning |
| 2 | `特定技能1号・農業で必要書類チェックリストを見せて。省略できる書類も分けて` | `list_visa_documents` / grouped checklist UI with omission and multilingual badges |
| 3 | `特定技能1号・農業の手続きで、まず何から確認すべき？` | `search_visa` / summary-first source-collapsed UI |
| 4 | `支援計画を変更したときの届出期限と様式を確認して` | `get_deadline_timeline` / compact deadline UI with related form links |
| 5 | `留学ビザの人を農業でフルタイム雇用してよいか確認して` | `validate_zairyu_compatibility` / H06 warning UI |

## タイムライン

| マイルストーン | 依存 | 期日目安 |
|---|---|---|
| UX redesign deploy | 完了 | 完了 |
| Screenshots 撮影 | UX redesign deploy + capture automation | 完了 |
| 提出パケット完成 | privacy check + screenshots + demo video | 2026-06 第1週 |
| **Anthropic 提出** | パケット完成 | 2026-06 第2週 |
| **OpenAI 提出** | 同上 (parallel) | 2026-06 第2週 |

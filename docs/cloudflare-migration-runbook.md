# Cloudflare 移行 Runbook (Sprint 5 Phase C)

> **対象ドメイン**: ssw-compass.jp (お名前.com → Cloudflare)
> **現状**: お名前.com DNS で `mcp.ssw-compass.jp A → 34.149.148.76`
> **目標**: Cloudflare を DNS プロキシとして挟み WAF + Bot Fight Mode + DDoS 保護を追加

---

## Phase 1: Cloudflare 登録とドメイン追加

### Step 1: Cloudflare アカウント作成 (壁さん)

1. https://dash.cloudflare.com/sign-up で登録 (無料プランで OK)
2. 「Add a Site」→ `ssw-compass.jp` を追加
3. プラン: **Free** (後で Pro に upgrade 可能)

### Step 2: 既存 DNS レコードを確認

Cloudflare が自動でお名前.com の DNS を読み込む。以下が正しくインポートされていることを確認:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | mcp | 34.149.148.76 | Auto |

### Step 3: Cloudflare ネームサーバーに切り替え

Cloudflare が提供する 2 つの NS を確認 (例: `ada.ns.cloudflare.com`, `ken.ns.cloudflare.com`):

**お名前.com での操作**:
1. ドメイン Navi ログイン → `ssw-compass.jp` → ネームサーバーの設定
2. 「他のネームサーバーを使用する」→ Cloudflare NS 2 つを入力
3. 保存 → NS 変更は 24-48 時間で伝播

---

## Phase 2: Cloudflare 設定

### DNS レコード設定 (NS 変更後)

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | mcp | 34.149.148.76 | **ON (オレンジ雲)** | Auto |
| CNAME | www | mcp.ssw-compass.jp | ON | Auto |

**Proxy ON** = Cloudflare が IP を隠蔽 + WAF 適用。

### セキュリティ設定

1. **SSL/TLS** → 「Full (strict)」モード (Google 側証明書 ACTIVE 済みのため)
2. **WAF** (Web Application Firewall) → Managed Rules を有効化
   - OWASP Core Ruleset: ON
   - Cloudflare Managed Rules: ON
3. **Bot Fight Mode** → ON (Settings → Security → Bots)
4. **DDoS Protection** → デフォルトで有効 (Free でも基本は ON)
5. **Rate Limiting** (Pro プラン以降): `/mcp` エンドポイントに追加制限

### Page Rules (Free プラン)

| URL | Setting | Value |
|---|---|---|
| `mcp.ssw-compass.jp/*` | Cache Level | Bypass (API は常にオリジン) |

---

## Phase 3: 動作確認

```bash
# Cloudflare が front に入っているか確認
curl -sI https://mcp.ssw-compass.jp/health | grep -i 'cf-ray'
# CF-Ray ヘッダーがあれば Cloudflare 経由

# DDoS シミュレーション (Cloudflare のテスト機能は別途)
# Rate limit: ステージング の Cloud Armor が 10req/min なので本番は慎重に
```

---

## Cloud Armor との関係

| Layer | 役割 | 適用範囲 |
|---|---|---|
| **Cloudflare** (新) | CDN + DDoS + WAF (geographically distributed) | SSW Compass Japan 全ドメイン |
| **Cloud Armor** (既存) | Rate limit + geo-block + RFC1918 block | Google LB → Cloud Run |

2 層防御の ADR は Sprint 5 内に起票予定 (ADR-021 候補)。

---

## 注意事項

- Cloudflare Free プランの WAF はマネージドルールのみ。カスタムルールは Pro ($20/月) 以降。
- Google-managed SSL cert は Cloudflare proxy ON でも動作する (Flexible ではなく Full strict を使用すること)。
- お名前.com の NS 変更は不可逆ではないが、切り戻しには最大 48h の DNS 伝播時間が必要。

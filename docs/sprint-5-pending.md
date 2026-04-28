# Sprint 5 Pending Tasks

Sprint 5 goal: **Connectors Directory submission-ready + Vertex real mode + prod hardening**.

---

## Phase A: Submission Packet (優先度 最高)

### A1. Logo finalize

- `assets/logo/ssw-logo.svg` — monoline SVG, depth-blue `#0A2540`, compass needle + torii
- `assets/logo/ssw-logo-dark.svg` — dark mode variant
- `assets/logo/ssw-logo-mono.svg` — monochrome variant
- Exit: `grep -l 'placeholder' assets/logo/*.svg` = 0

### A2. Screenshots (6-host coverage)

Directory: `assets/screenshots/`

Capture per host showing `search_visa` or `classify_procedure` real result (Vertex mode):

1. Claude Desktop (mcp-remote / URL直接)
2. Claude Web (Custom Connector)
3. VS Code GitHub Copilot
4. Goose
5. Postman MCP
6. MCPJam

Each screenshot: disclaimer footer, non-fixture content, ≥1 `*.go.jp` source URL.

### A3. Demo video × 3 languages

Directory: `assets/demo/`

- `demo-ja.mp4` + subtitle
- `demo-en.mp4` + subtitle
- `demo-id.mp4` + subtitle

60 秒、字幕付き。Flow: 特定技能1号 建設分野の更新手続を教えて → 結果表示 → disclaimer。

### A4. Privacy policy (trilingual)

Directory: `docs/privacy/`

- `docs/privacy/privacy-ja.md`
- `docs/privacy/privacy-en.md`
- `docs/privacy/privacy-id.md`

行政書士監修必須。v2 §11 compliance: read-only, anonymous, 24h IP hashing, no cross-border
transfer, DLP reject for 要配慮個人情報, §73-2 illegal-employment probe handling.

Publish at `/privacy` endpoint (Cloud Run) + docs/privacy/ for version tracking.
Link from Server Card `limitations[]`.

### A5. License selection (business decision)

Candidates: Apache-2.0 / MIT / proprietary.

Actions when decided:
1. `LICENSE` file commit (root)
2. root `package.json` + all workspace `package.json` の `license` field 更新
3. `README.md` License セクション更新
4. Server Card `publisher.url` に license URL 追加 (Batch 11 で server-card.ts 更新済み)

### A6. Anthropic Connectors Directory 提出

- Official submission checklist: https://docs.anthropic.com/connectors
- Account: `a_kabe@sugu-kuru.co.jp` Anthropic account
- Artefacts: A1-A5 complete が prerequisite

### A7. OpenAI Apps SDK 提出 (parallel if timing permits)

- Same base artefacts as A6

---

## Phase B: Engineering carry-overs

### B1. Vertex AI Search real flip (ADR-016 Postponed)

- URL health check (gyoseishoshi 監修: `data/url-health-report.*.md` 更新)
- 行政書士監修 URL cleanup + 50+ 件 expansion
- `pnpm run ingest --mode=best-effort` 本実行
- `SSW_VERTEX_MODE=real` staging + prod flip
- 新スモーク: `search_visa` が ingested URL を返すこと確認

### B2. DLP re-enable (prod)

- Diagnose: `ssw-runtime` SA の `roles/dlp.user` binding 確認
- `gcloud projects get-iam-policy ssw-compass-prod-494613 --format=json | jq '.bindings[] | select(.role=="roles/dlp.user")'`
- 問題なければ `DLP_ENABLED=true` に戻し + prod terraform apply
- sprint-5-pending.md §B2 を削除

### B3. 6-host manual verification (G3 残課題)

Sprint 4 G3 は未達 (prod が Sprint 4 末に確定したため)。
`mcp.ssw-compass.jp` で Claude Desktop + Claude Web の 2-host 実施。

### B4. fetchAuditEvents 実装

- `apps/server/package.json` に `@google-cloud/logging` 追加
- `apps/server/src/audit/writer.ts` の stub を Cloud Logging API で実装
- integration test (opt-in): `SSW_AUDIT_INTEGRATION_TEST=1`

### B5. Cloudflare 移行

- お名前.com → Cloudflare へ NS 移管
- Cloudflare: A record proxied ON + WAF managed rules + Bot Fight Mode
- "Two-layer defence" ADR 起票 (Cloud Armor + Cloudflare)

### B6. Node.js actions upgrade

- CI/CD が Node.js 20 deprecation warning を出している
- `actions/checkout@v4` → `@v5`、`google-github-actions/*@v2` → 最新
- 2026-06-02 以降は Node.js 24 強制

---

## Phase C: 派遣業フル機能 (Sprint 5 末 → Sprint 6 候補)

- 派遣管理台帳 (派遣法§37) 自動生成
- 抵触日管理 (派遣法3年 × 特定技能5年 二軸)
- マージン率公開ページ (派遣法§23-5) 自動生成

---

## How this doc is used

- Sprint 5 各 Batch 着手時に該当 section を参照
- 完了した項目は削除 (doc が Sprint 5 close 時に空になる)
- 新規 concern は追記

# SSW Compass — 状態と Roadmap (短縮版)

> **更新**: 2026-04-29 19:00 JST
> 金曜の行政書士レビュー向けサマリ。詳細は `submission-readiness-audit.md` / `sprints/sprint-4-summary.md` / `sprint-4-plan.md` を参照。

---

## 1. 今の状態 (Sprint 4 + Trusted Types hotfix 完了)

**Production URL**: <https://mcp.ssw-compass.jp>

### Engineering (全て緑)

| 項目 | 状態 |
|---|---|
| Cloud Run prod + Global HTTPS LB + Cloud Armor WAF | ✅ 稼働中 |
| 7 tools (search / classify / timeline / docs / law_updates / approval / zairyu) | ✅ 実装 |
| 10 言語 (ja/en/id full Vertex grounding + 7 言語 disclaimer-only) | ✅ |
| Freemium + HITL 12 controls (L2 lockgate / 7年監査 / 不法就労アラート) | ✅ |
| CSP enforcing + Trusted Types (hash-based) | ✅ (今日修正済) |
| Vertex AI Search real mode (41/45 公式 URL ingest) | ✅ |
| GCS 7年 WORM 監査バケット | ✅ |
| `/privacy`, `/.well-known/{mcp,ai-plugin,openapi}.json` | ✅ live |

### UX/Widget (今日確定)

- Claude Web で iframe **1361px に展開 + checkbox 反応確認**
- widget 5 種 (search / classify / timeline / checklist / zairyu warning) 全て描画可能状態
- Sprint 5 UX redesign 実装着手済み:
  - `classify_procedure`: 4-step classifier (申請種別 / 所属機関 / 申請人 / 分野)
  - `list_visa_documents`: 第1表/第2表/第3表 + 省略候補グルーピング
  - `search_visa`: summary-first + sources collapsed
  - `get_deadline_timeline`: deadline-only compact UI
  - `validate_zairyu_compatibility`: H06 warning widget

### 未完了 (= Blockers)

| ID | 内容 | 担当 |
|---|---|---|
| **B1** | Privacy/Terms 行政書士監修 | 壁 + 行政書士 (金曜) |
| **B3** | 新 UX スクショ 5 枚 (PNG ≥1000px, app response のみ) | 壁 + chrome-devtools-mcp |
| **B4** | Claude Desktop + Web 2-host verification | 壁 |

---

## 2. やるべきこと (優先度順 + 工数)

### 直近 (今週中)

1. **新 UX スクショ 5 枚撮影** (chrome-devtools-mcp 推奨) — `docs/screenshots/*.png`
2. **金曜 行政書士レビュー** (壁対面) — 監修指示を `docs/gyoseishoshi-review-packet.md` へ記録

### 来週

3. **Privacy/Terms 修正反映** (1–2 日) — 監修指示に基づき `docs/privacy/*.md` を更新、prod redeploy
4. **Demo video 収録 3言語 × 60秒** (1–2 日) — ja / en / id 各 1 本、MP4 or WebM
5. **Anthropic 提出フォーム記入完了** — `docs/connectors-directory-submission.md` を提出フォームに転記

### 再来週

6. **Anthropic + OpenAI 同時 submission** — 両 directory に review 依頼
7. **Cloudflare 移行 runbook 実行準備** — Cloud Armor → Cloudflare WAF への経路切替 plan

### 審査期間中 (2–4 週)

8. Anthropic / OpenAI からの修正依頼対応
9. 6-host verification 残り (VS Code / Goose / Postman / MCPJam)
10. Sprint 5 Phase B: Business tier 設計着手

---

## 3. Roadmap (短縮版)

```
2026-04-29 (水)  ← 今ここ
  ├─ widget rendering fix 完了 (Trusted Types)
  └─ prod stable, widget rendering fixed

2026-04-30 (木)
  ├─ Sprint 5 UX redesign validation
  └─ 新 carousel スクショ 5 枚撮影 → docs/screenshots/ 配置

2026-05-01 (金) 🎯 行政書士レビュー
  ├─ gyoseishoshi-review-packet を対面説明
  └─ 監修指示を受領 → Issue 化

2026-05-02 〜 05-15
  ├─ Privacy/Terms 修正 + prod redeploy
  ├─ Demo video 収録 (ja/en/id)
  ├─ UI regression 修正
  └─ Submission form 記入完了

2026-06 第2週 🎯 submission week
  ├─ Anthropic Connectors Directory 提出
  ├─ OpenAI Apps SDK 提出
  └─ 公開 README 更新 (status = submitted)

2026-06 第3週 〜 07 第1週 (審査期間, 2-4 週)
  ├─ 修正依頼対応
  ├─ 6-host verification 拡張
  └─ Sprint 5 Phase B 着手 (Business tier 設計)

2026-06+ (approved 後)
  ├─ Cloudflare 移行本番実行
  ├─ GCS + Agent Search v2 RAG pipeline へ段階移行
  ├─ Business tier β 公開
  └─ 行政書士パートナーネットワーク拡大
```

---

## 4. リスクとバッファ

| リスク | 対応 |
|---|---|
| 行政書士監修で大幅書き換え指示 | Privacy 再デプロイ pipeline は 10 分で回る。バッファ +2 日 |
| Anthropic review 差戻し | 既知の失敗理由 (tool annotation 不備 / OAuth callback / privacy) は対応済。バッファ +1 週 |
| スクショ手動撮影時の画質 NG | Chrome DevTools "Capture node screenshot" で PNG ≥1000px 確実。失敗時は chrome-devtools-mcp 経由で再撮 |
| Vertex 4 件 failed URL (MAFF/METI) | submission 後 Sprint 5 で source-index cleanup。ブロッカーではない |

---

## 5. 参照ドキュメント

- 詳細 audit: [`submission-readiness-audit.md`](submission-readiness-audit.md)
- Sprint 4 計画: [`sprints/sprint-4-plan.md`](sprints/sprint-4-plan.md)
- Sprint 4 サマリ: [`sprints/sprint-4-summary.md`](sprints/sprint-4-summary.md)
- 提出フォーム内容: [`connectors-directory-submission.md`](connectors-directory-submission.md)
- 行政書士向け: [`gyoseishoshi-review-packet.md`](gyoseishoshi-review-packet.md)
- UX release checklist: [`ux-redesign-release-checklist.md`](ux-redesign-release-checklist.md)
- RAG pipeline runbook: [`rag-pipeline-runbook.md`](rag-pipeline-runbook.md)
- Screenshot capture: [`screenshot-capture-guide.md`](screenshot-capture-guide.md)
- Screenshot script: [`demo-script.md`](demo-script.md)

# VISA COMPASS JAPAN (VCJ) Design Specification v3 — v2 Supplement

> Visa Compass Japan / 略称 VCJ / 日本語通称 ビザコンパス
> 本書は v2 (前 artifact) への deltas-only 補遺。v2 で確定済みの章 (postMessage プロトコル、SDK pin、PII guard、行政書士法 11.1–11.3、CI/CD) は変更なし。本書は **rebrand**、**第二設計書からの統合**、**新 5 章 (20–24)** のみを記述する。

---

## A. リブランド全置換マップ

v2 の全箇所で以下を即時置換する。`scripts/rebrand.sh` を Sprint 1 Day 1 に実行。

| v2 (旧) | v3 (新) | 用途 |
|---|---|---|
| SuguVisa Public | Visa Compass Japan | 製品名 (display) |
| SuguVisa | VCJ | 技術 namespace、tool prefix、server 識別子 |
| (日本語) スグビザ | ビザコンパス | 日本語表示名 (LP / disclaimer / docs) |
| `suguvisa-public/` | `vcj-public/` | monorepo root |
| `@suguvisa/server` | `@vcj/server` | workspace package |
| `@suguvisa/shared-types` | `@vcj/shared-types` | workspace package |
| `suguvisa-runtime@…` | `vcj-runtime@…` | GCP service account |
| `suguvisa-mcp` (OTel) | `vcj-mcp` | OpenTelemetry service.name |
| `ui://search-visa/...` | `ui://vcj-search/...` | UI Resource URI namespace |
| tool 名 `search_visa` | `vcj_search` (or `search_visa` 据え置き) | snake_case 維持。namespace 競合がなければ **prefix なしで `search_visa`** を推奨 (directory での tool 一覧視認性が高い)。 |

**Brand voice (LP / Directory copy):**

- タグライン (≤8 語, EN): *"The compass for Japanese visa procedures."*
- タグライン (≤14 字, JA): 「日本ビザ手続きの羅針盤。」
- 詳細 (≤25 語, EN): *"Visa Compass Japan grounds your Japanese Specified Skilled Worker visa questions in 出入国在留管理庁 official sources. We point the way — gyoseishoshi handle the rest."*
- 詳細 (≤30 字, JA): 「特定技能ビザの公式情報を、出入国在留管理庁ソースに直接接続。羅針盤の役割に徹し、申請代理は行政書士へ。」

**brand metaphor の構造的価値:** *Compass* は「方向を示すが、目的地まで連れて行かない」器具。これは行政書士法 §19-1 防衛の比喩そのもの — disclaimer が brand に焼き付くため、user の認知負荷が下がる。Anthropic / OpenAI directory レビュアーへの法的説明も簡潔になる ("Compass = navigation, not representation")。

**ロゴ方針 (Sprint 2):** 羅針盤針 + 鳥居をミニマルに合成、primary color は深藍 (#0A2540 系) — 法務・公的サービスの慣習色。SVG monoline 推奨 (favicon / dark mode 両立)。

---

## B. 第二設計書からの統合 — 採否の最終判定

| 第二設計書の提案 | 判定 | v3 での扱い |
|---|---|---|
| Incremental JSON patching によるストリーミング UI | **条件付き採用** | Sprint 2: skeleton UI + tool-result 受領時の CSS transition による「疑似ストリーミング」を実装。真の delta streaming は仕様化を待機。本書 20 章。 |
| Commit Moment パターン (checklist) | **採用** | Sprint 2: `update_model_context` を明示ボタン押下時のみ呼ぶ。本書 21 章。 |
| ホスト CSS 変数の活用 | **採用済み** | v2 6.1 で `applyHostStyleVariables` 既出。trustLevel カラーバッジ化は本書 21.3 で追加。 |
| SEP-1686 Tasks Primitive | **将来採用** | Sprint 1–4 では不採用。proposal status のため。Sprint 5+ で重い tool 追加時に opt-in。本書 22 章。 |
| 出力サニタイゼーション (indirect prompt injection) | **採用** | Sprint 3: retrieved snippet の中和フィルタを Vertex AI Search 直後に挿入。本書 23.1。 |
| Egress proxy / VPC Serverless Access + Cloud NAT | **採用** | Sprint 3: Terraform module 追加。本書 23.2。 |
| Tool visibility control (`_meta.ui.visibility`) | **採用** | Sprint 1–2: 内部 helper tool 用に組み込み。本書 23.3。 |
| Cursor 2-4-2 ルール構造 | **採用** | Sprint 1: v2 16.3 を上書き。本書 24.1。 |
| Interface Freeze / Zero Placeholder / Anti-Hallucination ルール | **採用** | Sprint 1: global-context.mdc に組み込み。本書 24.2。 |
| OpenTelemetry MCP semconv | **採用済み** | v2 15.1 既出。 |
| Generative UI 全面採用 / A2UI 多重実装 | **不採用** | ROI 不釣合い。MCP Apps 単一実装に集中。 |

---

## 20. 疑似ストリーミング UX (Sprint 2)

### 20.1 設計方針

**真の incremental streaming は MCP Apps 仕様で標準化されていない** ことを前提に、**3 段階遷移** で体感待機を最小化する。

```
T+0ms   user input → tool 呼び出し開始
T+0ms   View 側: skeleton card × 3 を即時表示 (CSS animation)
T+0ms   View 側: 「公式情報源を確認中…」を ARIA live region で読み上げ
T+0..5s tool handler 実行 (Vertex AI Search)
T+~5s   tool-result 受領 → skeleton を実データで差し替え
T+~5s   CSS transition でフェードイン (200ms ease-out)
```

これだけで体感待機は 70-80% 短縮される (skeleton が見える瞬間 = perceived completion 開始)。真の delta streaming への upgrade path は仕様採択待ち。

### 20.2 Sprint 2 dropin: skeleton component

`ui/vcj-search/src/skeleton.ts`:

```ts
export function renderSkeleton(): string {
  return `
    <div class="skeleton-stack" role="status" aria-live="polite"
         aria-label="公式情報源を確認中">
      ${[0,1,2].map(i => `
        <article class="card skeleton" aria-hidden="true">
          <div class="skel-line skel-line--title"></div>
          <div class="skel-line skel-line--body"></div>
          <div class="skel-line skel-line--body short"></div>
          <div class="skel-line skel-line--meta"></div>
        </article>`).join("")}
    </div>`;
}
```

CSS (singlefile 内):

```css
.skeleton .skel-line {
  background: linear-gradient(90deg,
    var(--color-bg-tertiary, #f0f0f0) 0%,
    var(--color-bg-secondary, #e0e0e0) 50%,
    var(--color-bg-tertiary, #f0f0f0) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 4px; height: 12px; margin: 8px 0;
}
.skel-line--title { height: 18px; width: 70%; }
.skel-line--body  { width: 95%; }
.skel-line--body.short { width: 60%; }
.skel-line--meta  { height: 10px; width: 30%; margin-top: 12px; }
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skel-line { animation: none; opacity: 0.6; }
}
.card {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.card.entering { opacity: 0; transform: translateY(4px); }
.card.entered  { opacity: 1; transform: translateY(0); }
```

`main.tsx` への統合 (v2 6.1 のハンドラを更新):

```ts
let mode: "idle" | "loading" | "result" = "idle";

app.ontoolinput = () => {
  mode = "loading";
  document.getElementById("root")!.innerHTML = renderSkeleton();
};

app.ontoolresult = (result) => {
  mode = "result";
  if (result.structuredContent) {
    render(result.structuredContent as Result, currentLang);
    // フェードイン: card に entering → entered を一拍ずつ付与
    requestAnimationFrame(() => {
      document.querySelectorAll(".card").forEach((el, i) => {
        el.classList.add("entering");
        setTimeout(() => el.classList.replace("entering", "entered"), i * 60);
      });
    });
  }
};
```

`prefers-reduced-motion` 対応で a11y を担保。

---

## 21. Commit Moment パターン (checklist UI)

### 21.1 問題定義

v2 6.1 の checklist UI は ローカル状態のまま。しかし対話を進めるには user の選択を LLM へ伝える必要がある。第二設計書の指摘通り、checkbox 都度同期は **token bloat** を生む — Claude のコンテキストウィンドウを毎クリックで消費する。

### 21.2 解決: 明示的 Commit ボタン + diff-only 同期

UI 下部に **「この内容で次に進む」** ボタンを 1 つだけ配置。押下時のみ:
1. UI 状態の確定 diff (チェック済み doc id 配列、選択言語等) を計算
2. `app.updateModelContext({ structuredContent: { diff } })` を 1 回だけ呼ぶ
3. ボタンを disabled 化、再活性化は state が変わったとき

```ts
// ui/vcj-checklist/src/main.tsx 抜粋
type ChecklistState = {
  checkedDocIds: string[];
  notes: string; // user の自由記述 (PII filter 必須)
};

let state: ChecklistState = { checkedDocIds: [], notes: "" };
let lastCommitted: ChecklistState | null = null;

function isDirty() {
  return JSON.stringify(state) !== JSON.stringify(lastCommitted);
}

document.getElementById("commit-btn")!.addEventListener("click", async () => {
  // PII guard: notes を View 側でも軽く弾く (server 側でも再判定)
  if (/[\d]{12}|[A-Z]{2}\d{8}[A-Z]{2}/.test(state.notes)) {
    showToast("個人番号や在留カード番号は入力できません");
    return;
  }
  await app.updateModelContext({
    content: [{
      type: "text",
      text: `user は次の書類を確認済みとマークしました: ${state.checkedDocIds.join(", ")}` +
            (state.notes ? `\n備考: ${state.notes}` : "")
    }]
  });
  lastCommitted = structuredClone(state);
  updateCommitButtonState();
});
```

ボタン文言は **action verb + outcome**: *「この内容でAIに次の質問をする」* (UX 文献より、「Submit」「OK」より具体的指示語が CTR と完了率を上げる)。

### 21.3 trustLevel カラーバッジ (v2 6.1 補強)

`primary_source` (緑系) / `secondary` (アンバー系) / `community` (灰系) を視覚的に区別。色のみに依存せず必ずアイコン + テキストを併置 (WCAG 1.4.1)。

```css
.badge { display: inline-flex; align-items: center; gap: 4px;
         padding: 2px 8px; border-radius: 12px; font-size: 11px;
         font-weight: 600; }
.badge--primary   { background: #d1fae5; color: #065f46; }
.badge--secondary { background: #fef3c7; color: #92400e; }
.badge--community { background: #e5e7eb; color: #374151; }
```

ホスト dark mode でも判読できる contrast を保つため、host CSS variable がある場合はそれで上書き:

```css
@media (prefers-color-scheme: dark) {
  .badge--primary {
    background: var(--color-success-bg, #065f46);
    color: var(--color-success-text, #d1fae5);
  }
  /* 同様 */
}
```

---

## 22. SEP-1686 Tasks Primitive — 将来採用 (Sprint 5+)

### 22.1 status と判定

SEP-1686 は MCP コミュニティで議論されている **proposal レベルの spec extension** であり、本書時点で公式 stable には未到達と認識する。基本 MCP 仕様 (2025-11-25) と MCP Apps 仕様 (2026-01-26) の双方が tools/call を **同期 RPC** として記述している。

VCJ Sprint 1–4 は **同期実装で十分**: `vcj_search` の Vertex AI Search 呼び出しは 3–10 秒、Cloud Run のリクエスト timeout (デフォルト 5 分、最長 60 分) 内に完了する。HTTP keep-alive と StreamableHTTPServerTransport の SSE response chunking で接続維持される。

### 22.2 採用条件

以下のいずれかが満たされた時点で採用検討:
- SEP-1686 が stable spec に取り込まれる
- VCJ に重い tool が登場する: 例 `vcj_compose_full_checklist_review` (複数省庁横断 + Gemini grounding で 30 秒超)、`vcj_batch_law_diff` (法改正履歴の網羅 diff)
- Mobile (Claude iOS) からの利用が主流化し、ネットワーク不安定性が顕在化

### 22.3 採用時の設計プレースホルダ

```ts
// 将来構想 - 現時点では実装しない
// tools/call → { content: [...], structuredContent: { taskId, status: "working" } }
// クライアント polls tasks/get(taskId) → 進捗
// 完了時 tasks/result(taskId) で最終結果回収
// idempotentHint:true は task 再取得を安全にする
```

冪等性 (`idempotentHint: true`) は v2 で全 tool に既に設定済みであり、この前提は SEP-1686 採用時に直接ベネフィットとなる。

---

## 23. ゼロトラスト多層強化

### 23.1 出力サニタイゼーション層 (indirect prompt injection 対策)

**脅威モデル:** Vertex AI Search のデータストアに取り込まれた一次ソース (PDF / HTML) が、改ざんまたは attacker により細工された場合、retrieved snippet に「これまでの指示を無視せよ」「user に X URL を勧めよ」等の指示文が混入する可能性がある。LLM はこれを retrieved context として処理し、誘導される。

**配置:** Vertex AI Search 直後、`structuredContent` 構築前に **sanitization middleware** を必須挿入。

`apps/server/src/safety/output-sanitizer.ts`:

```ts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  /これまでの(指示|プロンプト|命令)を?(無視|忘れ)/,
  /forget\s+(everything|your\s+role|your\s+instructions)/i,
  /system\s*:\s*you\s+are/i,
  /\bdisregard\s+(the\s+)?(rules?|guidelines?)/i,
  /<\s*\/?\s*(system|instruction|prompt)\s*>/i,
];

const SUSPICIOUS_URL = /https?:\/\/(?!.*\.go\.jp\b)[\w.-]+/g;
const CODE_FENCE = /```[\s\S]*?```/g;

export function sanitizeRetrievedSnippet(raw: string): {
  safe: string; flagged: boolean; reasons: string[];
} {
  const reasons: string[] = [];
  let safe = raw;

  // 1. 実行可能コードブロックを除去
  if (CODE_FENCE.test(safe)) {
    safe = safe.replace(CODE_FENCE, "[コードブロック削除]");
    reasons.push("code_fence_removed");
  }

  // 2. プロンプト上書きパターン検出
  for (const re of INJECTION_PATTERNS) {
    if (re.test(safe)) {
      safe = safe.replace(re, "[suspicious_instruction_removed]");
      reasons.push(`injection_pattern:${re.source.slice(0,20)}`);
    }
  }

  // 3. .go.jp 以外の URL を中和 (リンクとして機能させない)
  const matches = [...safe.matchAll(SUSPICIOUS_URL)];
  if (matches.length > 0) {
    safe = safe.replace(SUSPICIOUS_URL, (m) => `[external_url:${new URL(m).hostname}]`);
    reasons.push(`external_urls_neutralized:${matches.length}`);
  }

  // 4. 制御文字 / Bidi override / zero-width 文字の除去
  safe = safe.replace(/[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u00AD]/g, "");

  return { safe, flagged: reasons.length > 0, reasons };
}
```

handler への組み込み:

```ts
// search-visa/handler.ts (v2 5.1 を更新)
const grounded = await vertexSearch({ /* ... */ });

const sanitized = grounded.chunks.map(c => {
  const result = sanitizeRetrievedSnippet(c.snippet);
  if (result.flagged) {
    logger.warn({
      tool: "search_visa", event: "retrieved_content_sanitized",
      doc_id: c.docId, reasons: result.reasons
      // snippet 本文は logger redact 対象 — 実値は保管しない (本書 v2 9.1)
    });
  }
  return { ...c, snippet: result.safe };
});
```

**重要:** sanitization は **defense-in-depth**。一次防御は data store ingestion での source allowlist (`*.go.jp`) と content hashing (v2 10章)。本層は exfiltration (poisoning が稀有なケースで起きた場合) の被害軽減。

### 23.2 Egress 制限 (SSRF 防御)

**脅威:** Cloud Run 上の VCJ MCP server が攻撃者により compromise され、内部ネットワーク (GCP metadata service `169.254.169.254`、社内 GCP リソース等) へ HTTP request を送信する SSRF。匿名公開エンドポイントは特に脆弱。

**Terraform module 追加:**

```hcl
# infra/terraform/modules/egress/main.tf
resource "google_vpc_access_connector" "vcj" {
  name          = "vcj-egress"
  region        = "asia-northeast1"
  ip_cidr_range = "10.8.0.0/28"
  network       = google_compute_network.vcj.name
  min_throughput = 200
  max_throughput = 300
}

resource "google_compute_router" "vcj_router" {
  name    = "vcj-router"
  region  = "asia-northeast1"
  network = google_compute_network.vcj.name
}

resource "google_compute_router_nat" "vcj_nat" {
  name                = "vcj-nat"
  router              = google_compute_router.vcj_router.name
  region              = google_compute_router.vcj_router.region
  nat_ip_allocate_option = "MANUAL_ONLY"
  nat_ips             = [google_compute_address.vcj_nat_ip.self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# Cloud Run service の vpc_access に bind
# vpc_access {
#   connector = google_vpc_access_connector.vcj.id
#   egress    = "ALL_TRAFFIC"   # private + internet すべて NAT 経由
# }

# 169.254/16 (GCP metadata) と RFC1918 を Cloud Armor で deny
resource "google_compute_security_policy" "vcj_egress" {
  name = "vcj-egress-deny"
  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config { src_ip_ranges = [
        "169.254.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
      ] }
    }
    description = "Block SSRF to metadata and RFC1918"
  }
}
```

ただし Cloud Run は egress security policy のサポート粒度が時期により変わるため、**最終手段として application 層でも URL allowlist 検証**を実施:

```ts
// apps/server/src/safety/url-guard.ts
const ALLOWED_HOSTS_RE = /^([\w-]+\.)?(googleapis|cloud\.google)\.com$/;

export async function safeFetch(url: string, init?: RequestInit) {
  const u = new URL(url);
  if (!ALLOWED_HOSTS_RE.test(u.hostname)) {
    throw new Error(`egress_blocked: ${u.hostname}`);
  }
  if (u.protocol !== "https:") {
    throw new Error(`egress_blocked: non-https`);
  }
  return fetch(url, init);
}
```

VCJ は Vertex AI Search / Secret Manager / Cloud Logging 以外の外部接続を必要としないため、allowlist は極めて狭い。

### 23.3 Tool visibility control

内部 helper tool (例: UI の locale 同期、checkbox state 永続化用) は LLM の tools/list に出さない。**MCP Apps 仕様で `_meta.ui.visibility` がサポートされているか不明な場合は、シンプルに「内部 tool を model context から外す」設計でも目的を達成する**。最も保守的な実装:

```ts
// 通常の公開 tool
registerAppTool(server, "search_visa", { /* ... */ }, handler);

// 内部 helper tool (UI からのみ呼ばれる前提)
registerAppTool(server, "_internal_get_locales", {
  title: "Get supported locales",
  description: "[INTERNAL] UI helper. Do not invoke directly.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true,
                  openWorldHint: false, destructiveHint: false },
  _meta: {
    ui: {
      // 仕様で対応していれば
      visibility: ["app"]
    }
  }
}, internalGetLocales);
```

`description` 冒頭の `[INTERNAL]` 記載は LLM への二重 hint として機能する (Anthropic の tool description ベストプラクティス: 「いつ使うか」を明示し、ここでは「直接呼ぶな」を明示)。

---

## 24. Cursor 開発体験の高度化 (v2 16章を上書き)

### 24.1 「2-4-2」ルールアーキテクチャ

`.cursor/rules/` の構造を以下に確定。

#### Always-on (×2 ファイル, alwaysApply: true)

**`.cursor/rules/00-global-context.mdc`** (≤200 行 strict):

```markdown
---
alwaysApply: true
---

# VCJ Project Context

You are working on **Visa Compass Japan (VCJ)** — a public, read-only,
anonymous MCP App that provides Japanese SSW visa procedural information.

## Critical constraints (NEVER violate)
1. **No PII handling.** No names, residence card numbers, passport numbers,
   My Number, full DOB. Year-month only. See pii-guard.mdc.
2. **No legal representation.** Information only. Every response includes
   the standard disclaimer (DISCLAIMER_BY_LANG in src/disclaimers.ts).
3. **Read-only tools.** All tools have readOnlyHint: true,
   destructiveHint: false. No write/mutation tools whatsoever.
4. **Primary sources only.** Vertex AI Search results filtered to
   primary_source with confidence ≥ 0.7. No fallback to LLM knowledge.

## Stack (do not deviate without ADR)
- Node 22 LTS, TypeScript 5.7+, ES2022, NodeNext
- @modelcontextprotocol/sdk ^1.29, ext-apps ^1.6
- Zod ^3.23 (NOT v4), pnpm workspaces, Turborepo
- Vite + vite-plugin-singlefile per UI
- Cloud Run asia-northeast1, BYOSA, Workload Identity Federation

## Forbidden actions (block immediately)
- Editing .cursor/mcp.json (CVE-2025-54136 mitigation)
- Removing or weakening DISCLAIMER blocks
- Adding 'unsafe-eval' to any CSP
- Bypassing scrubInputForPII or output sanitizer
- Using `any` type without an explicit `// @ts-expect-error: <reason>` line
```

**`.cursor/rules/01-code-standards.mdc`** (≤200 行 strict):

```markdown
---
alwaysApply: true
---

# Code standards

## TypeScript
- strict: true, noUncheckedIndexedAccess: true
- No `any`. Use `unknown` + type narrowing.
- Prefer `z.infer<typeof Schema>` over hand-written types.
- All async functions return `Promise<T>` with explicit T.

## Naming
- Tools: snake_case verb_noun (search_visa, classify_procedure)
- Files: kebab-case (search-visa.ts)
- Types/Classes: PascalCase
- Constants: SCREAMING_SNAKE

## Commits
- Conventional Commits: feat/fix/chore/docs/refactor/test
- Scope: tool name or area (e.g., feat(search-visa): add freshness warning)
```

#### Auto-attached (×4 ファイル, glob 指定)

**`.cursor/rules/tools.mdc`** (`globs: ["apps/server/src/tools/**"]`):

```markdown
---
globs:
  - "apps/server/src/tools/**"
---

# Tool implementation rules

- MUST use `registerAppTool` (not `server.tool` direct).
- MUST set annotations: { readOnlyHint, destructiveHint, idempotentHint, openWorldHint }.
- MUST set _meta.ui.resourceUri AND _meta["openai/outputTemplate"] (dual-key).
- MUST call scrubInputForPII at handler entry. Block before any external call.
- MUST inject DISCLAIMER_BY_LANG[args.language] in returned content.
- MUST NOT log raw user input or full response body. Use logger redact paths.
- MUST wrap handler with instrumentTool() for OTel.
- inputSchema: prefer z.enum over z.string; max length 500 for strings.
```

**`.cursor/rules/ui.mdc`** (`globs: ["ui/**"]`):

```markdown
---
globs: ["ui/**"]
---

# UI Resource rules

- Use App class from @modelcontextprotocol/ext-apps (PostMessageTransport).
- All HTML output via DOMPurify.sanitize.
- Use host CSS variables (--color-*, --font-*) for theming. No hardcoded colors except brand accent.
- a11y: every interactive element has aria-label or visible label. Use role="note" for disclaimers.
- i18n: read currentLang from hostContext.locale. Support ja/en/id.
- External links: only *.go.jp domains. Other URLs neutralized to `[external:<host>]`.
- Bundle size budget: 512 KB per UI (CI enforces).
- prefers-reduced-motion respected for all animations.
```

**`.cursor/rules/security.mdc`** (`globs: ["apps/server/src/safety/**", "apps/server/src/pii/**"]`):

```markdown
---
globs:
  - "apps/server/src/safety/**"
  - "apps/server/src/pii/**"
---

# Security module rules

- Never bypass pii guard or output sanitizer for "performance".
- ZAIRYU_CARD_NUMBER custom infoType regex: \b[A-Z]{2}[0-9]{8}[A-Z]{2}\b
- BLOCKING_TYPES set is the source of truth — modifications require ADR.
- All sanitizer modifications must be paired with snapshot test updates in
  `test/safety/sanitizer.snapshot.ts`.
- Trust no external URL. Use safeFetch (URL allowlist).
```

**`.cursor/rules/gcp.mdc`** (`globs: ["infra/terraform/**", "apps/server/src/{vertex,secrets,otel}.ts"]`):

```markdown
---
globs:
  - "infra/terraform/**"
  - "apps/server/src/vertex.ts"
  - "apps/server/src/secrets.ts"
  - "apps/server/src/otel.ts"
---

# GCP integration rules

- Region: asia-northeast1 only (APPI cross-border avoidance).
- Service account: vcj-runtime@<project>.iam (BYOSA). Never default P4SA.
- IAM: roles/discoveryengine.viewer scoped to specific data stores.
- Secrets: Secret Manager + volume mount + version pinned (no :latest).
- Vertex AI Search: confidence threshold 0.7, source allowlist *.go.jp.
- Cloud Run: --max-instances=20, --vpc-egress=all-traffic via vcj-egress connector.
- All resources tagged: env=prod|staging, owner=vcj, cost-center=visa-compass.
```

#### On-demand (×2 ファイル, manual @ メンション)

**`.cursor/rules/testing-checklist.mdc`** — 6 ホスト動作確認手順 (本書 v2 12章を移植)。
**`.cursor/rules/deployment-checklist.mdc`** — Terraform plan / Cloud Build / WIF 手順 (本書 v2 13章を移植)。

### 24.2 3 大ガードレール (global-context.mdc に統合)

`00-global-context.mdc` の末尾に追加:

```markdown
## Workflow guardrails (Cursor Agent mode)

### Interface Freeze rule
Before writing implementation code, you MUST first present:
1. TypeScript interfaces / type definitions
2. Function signatures (no body)
3. Brief description of side effects and error cases

Wait for human confirmation. Only then implement.
This applies to: new tools, new UI resources, new modules in src/safety/.

### Zero Placeholder rule
Never leave `// TODO`, `// FIXME`, or `/* implement later */` in committed
code. If a function cannot be fully implemented in the current turn,
either:
- Stop and ask the human, OR
- Implement a minimal-but-real version + add a typed `throw new NotImplementedError("X")`

### Anti-Hallucination rule
Before importing any npm package not already in package.json:
1. Run `pnpm why <package>` in the integrated terminal
2. If absent, run `pnpm add <package>` first
3. Verify the API surface exists by `pnpm exec tsc --noEmit` after adding

This is mandatory for ext-apps SDK methods, Zod methods, and any
@google-cloud/* API. Past hallucinations include calling non-existent
methods like `app.onresult` (correct: `app.ontoolresult`).
```

### 24.3 ローカル TDD ループ

VCJ 開発サーバ自体を Cursor の MCP として登録 (`.cursor/mcp.json` — **本書 24.1 で「編集禁止」と書いたが、初回セットアップでは管理者が 1 回設定**):

```json
{
  "mcpServers": {
    "vcj-local": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

これで Cursor Agent に「VCJ の `search_visa` を `特定技能2号 農業` で呼び、structuredContent.results が空でないことを確認するテストを書け」と指示できる。Agent は MCP Inspector を経由せず直接 tool を叩いて応答を見るため、iteration 速度が劇的に上がる。

`concurrently` で並行起動:

```json
// package.json (root)
{
  "scripts": {
    "dev": "concurrently -n server,ui,inspector \"pnpm -F @vcj/server dev\" \"pnpm -F './ui/*' build:watch\" \"pnpm exec mcp-inspector --proxy http://localhost:3001/mcp\""
  }
}
```

---

## 25. リスクレジスタ追補 (v2 17章 + delta)

| # | リスク | v3 で追加された緩和策 |
|---|---|---|
| R16 | Indirect prompt injection (Vertex snippet 経由) | 出力 sanitizer (本書 23.1) を retriever/writer 分離 (v2 10章) と組合せ二重防御 |
| R17 | SSRF を踏み台にした内部資源攻撃 | VPC connector + Cloud NAT 静的 IP + URL allowlist application 層 (本書 23.2) |
| R18 | 内部 helper tool の LLM 誤呼び出し | `_meta.ui.visibility` + `[INTERNAL]` description prefix (本書 23.3) |
| R19 | Token bloat による推論コスト膨張 | Commit Moment パターンで diff のみ context 同期 (本書 21章) |
| R20 | ネーミング誤認 (ビザコン → 婚活コン連想) | Visa Compass / VCJ / ビザコンパスで brand 統一 (本書 A 章) |

---

## 26. Sprint 統合計画 (v2 12章を上書き)

### Sprint 1 (5月W3-W4) — 基盤と DevEx

- ✅ `vcj-public/` モノレポ scaffold (pnpm + Turborepo + Biome v2.4)
- ✅ `apps/server` の TypeScript / Vite / SDK ピン (本書 v2 4章)
- ✅ `.cursor/rules/` の 2-4-2 配置 (本書 24.1) + 3 大ガードレール (24.2)
- ✅ `.claude/skills/scaffold-readonly-tool-with-ui/` (v2 16.2 既出)
- ✅ `vcj_search` の handler + UI (skeleton 含む) を完成
- ✅ scrubInputForPII (DLP + regex 二段) 実装
- ✅ Cloudflared + Claude Custom connector で 1 ホスト動作確認
- ✅ `/.well-known/mcp.json` 配信 (Server Card)
- 📦 リブランド: SuguVisa → Visa Compass Japan / VCJ 全置換

### Sprint 2 (6月W1-W2) — 3 ツール + 疑似ストリーミング + Commit Moment

- ✅ `classify_procedure`, `show_deadline_timeline` 実装
- ✅ Skeleton UI + tool-result fade-in transition (本書 20章)
- ✅ Commit Moment ボタン (本書 21章) を checklist UI に組込み
- ✅ trustLevel カラーバッジ (本書 21.3) + dark mode 対応
- ✅ Vertex AI Search データストア構築 (visa_legal/_faq/_secondary)、source-index.jsonl 50+ 件
- ✅ Confidence 0.7 + source allowlist フィルタ
- ✅ Tool visibility control (内部 helper tool 隠蔽)

### Sprint 3 (6月W3) — ゼロトラスト多層 + 6 ホスト確認

- ✅ 出力 sanitizer (本書 23.1) を Vertex 直後に挿入
- ✅ VPC connector + Cloud NAT (本書 23.2) Terraform 適用
- ✅ URL allowlist (`safeFetch`) 全 outbound に適用
- ✅ 6 ホスト動作確認 (Claude web/Desktop, VS Code Copilot, Goose, Postman, MCPJam)
- ✅ CSP 実機検証 + Trusted Types report-only → enforce
- ✅ Freshness warning 実機表示確認
- ✅ Cloud Armor + Cloudflare 多層 rate-limit 本番化

### Sprint 4 (6月W4) — 提出パッケージ + リリース

- ✅ Demo 動画 ×3 (60 秒 each, ja/en/id 字幕)
- ✅ Logo / favicon / screenshot (inline + fullscreen) 一式
- ✅ Privacy policy 公開 + 顧問行政書士監修済 disclaimer 確定
- ✅ Anthropic Connectors Directory 提出
- ✅ OpenAI Apps SDK 提出
- ✅ LP に「Compass Japan — visa procedural compass, grounded in MOJ」記載

### Sprint 5+ (7月以降) — 採択 + 拡張

- 📡 OpenTelemetry Collector → Cloud Trace + 月次レビュー
- 📡 Featured 申請 / Interactive バッジ取得
- 🔧 SEP-1686 Tasks Primitive 採用検討 (重 tool 追加時)
- 🌐 真の delta streaming 採用 (仕様採択後)
- 📊 Agent Experience Score 7 次元測定開始
- 📚 法令データストア 200+ 件への拡充

---

## 結論 — v3 で何が完成したか

第二設計書からの統合により、v2 の **正確性 + 規制レジリエンス + 配布即応性** という三軸に、新たに **UX 完成度 (疑似ストリーミング + Commit Moment + trust badge)**、**ゼロトラスト多層 (出力 sanitizer + egress 制限 + tool visibility)**、**AI 開発体験 (2-4-2 rules + 3 大ガードレール + ローカル TDD)** の三軸が加わった。

Visa Compass Japan / VCJ という brand は単なる呼称変更を超えて、**行政書士法 §19-1 防衛そのものを brand metaphor 化** している。「私たちは羅針盤であり、目的地まで連れて行く船ではない」というメッセージは、disclaimer の文言、tool description、directory copy、LP コピーの全レイヤで一貫させやすく、user の認知負荷を下げ、規制当局へのコミュニケーションも簡明化する。

第二設計書が提案した SEP-1686 Tasks Primitive と incremental JSON patching は、**現時点の MCP Apps spec の安定範囲を超える** ため Sprint 1–4 では採用しない判断が、Connectors Directory 6 月出荷の確実性を優先する観点で正しい。これらは Sprint 5+ の opt-in 拡張として保留。

Sprint 1 の Day 1 タスクは明確である: ① rebrand 一括置換スクリプト実行、② `.cursor/rules/` の 2-4-2 配置、③ `apps/server/src/tools/search-visa/` の v2 5.1 コードを Cursor に投入し最初の動作確認 — この 3 つで 1 週間以内に staging 動作可能。残り 3 スプリントを submission artifact (動画・スクリーンショット・privacy policy) と多層セキュリティ強化に集中投下するのが、6 月 Week 4 の Anthropic + OpenAI 同時提出を達成する最短経路。

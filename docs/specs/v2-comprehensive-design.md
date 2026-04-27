# SSW Public Design Specification v2 — Comprehensive Research & Sprint 1 Ready Reference

> 監修対象: VISA COMPASS JAPAN (SSW) — 特定技能ビザ情報を提供する MCP App。Anthropic Connectors Directory + OpenAI Apps SDK 同時公開、6 ホスト対応、Cloud Run (asia-northeast1) 配信。本書は 2026年4月27日時点の一次情報に基づき、Sprint 1 で即実装可能な code/config を提示する。
>
> **本書 (v2) と v3-supplement.md は併読する**。SPEC-INDEX.md の「読み順」に従うこと。v3 が常に優先。本書のうち v3 で上書きされた章 (12, 16) は無視し、それ以外の技術詳細 (1, 4, 5, 7, 8, 9, 11, 13, 15) を正典として参照する。

---

## エグゼクティブサマリ — 5 つの最重要発見

第一に、`App` クラス・`registerAppTool` / `registerAppResource` ・`_meta.ui.resourceUri`・`@modelcontextprotocol/ext-apps` 命名はすべて 2026-01-26 公開のスペック (SEP-1865) と一致している。一方で **postMessage メソッド名 `ui/init` / `ui/data` / `ui/ready` / `ui/error` は非準拠** — 正しくは `ui/initialize`, `ui/notifications/initialized`, `ui/notifications/tool-input`, `ui/notifications/tool-result` (エラーは JSON-RPC `error`, code `-32000`)。

第二に、**2026年1月1日施行の改正行政書士法 §19-1** が「いかなる名目によるかを問わず報酬を得て」を明文化したため、**完全無償・独立 SKU として運営し、Disclaimer をプログラムに焼き付ける**ことが必要。

第三に、**特定技能・入管領域の MCP App は両ディレクトリで先行事例ゼロ**であり、第一号 launch + Interactive バッジ取得で featured 候補に十分入れる。

第四に、**SDK バージョン整合性**: `@modelcontextprotocol/sdk@^1.29.0` (v1 系、v2 はまだ alpha) + `@modelcontextprotocol/ext-apps@^1.6.0` + **Zod は v3.23.x で固定** (v4 は SDK 互換性問題が未解決)。

第五に、**Vertex AI のデフォルト P4SA は 2026年3月 Unit 42 公表の権限過剰問題があり、BYOSA (Bring-Your-Own-Service-Account) + Secret Manager + Workload Identity が必須**。

---

## 1章 — MCP Apps 最新仕様の正確な把握

### 1.1 postMessage プロトコル全列挙

**View → Host (lifecycle):**
- `ui/initialize` (request) — `appCapabilities { tools?, availableDisplayModes?: ("inline"|"fullscreen"|"pip")[], experimental? }` を送信、`McpUiInitializeResult { protocolVersion: "2026-01-26", hostCapabilities, hostInfo, hostContext }` を受信。
- `ui/notifications/initialized` (notification) — initialize 結果受領後に送信。

**View → Host (アプリ操作):**
- `ui/open-link` `{ url }`、`ui/message` `{ role:"user", content:{ type:"text", text } }`、`ui/request-display-mode` `{ mode }`、`ui/update-model-context` `{ content?, structuredContent? }`。

**View → Host (notifications):**
- `ui/notifications/size-changed` `{ width, height }`。

**Host → View (notifications):**
- `ui/notifications/tool-input` `{ arguments }` — initialize 完了後に **1 回のみ**、tool-result の前に必ず送信。
- `ui/notifications/tool-input-partial` — streaming 中 0..n 回。
- `ui/notifications/tool-result` — `CallToolResult { content, structuredContent, _meta }`。
- `ui/notifications/tool-cancelled` `{ reason }`。
- `ui/notifications/host-context-changed` `Partial<HostContext>` — theme/displayMode/locale/timezone 等。
- `ui/resource-teardown` (request, ack 必須) `{ reason }`。

### 1.2 Sandbox / CSP モデル

Web ホストでは **double-iframe sandbox proxy が MUST** — 外側 = Host と異なる origin の Sandbox proxy (`sandbox="allow-scripts allow-same-origin"`)、内側 = 実際の View HTML。CSP は **server が宣言**し **host が強制**する。

**外部 API を呼ぶなら `_meta.ui.csp.connectDomains` への明示宣言が必須**。

### 1.3 SDK / 依存バージョン (確定推奨)

| パッケージ | 推奨ピン | 根拠 |
|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.29.0` | v1 最新。v2 は alpha。 |
| `@modelcontextprotocol/ext-apps` | `^1.6.0` | 2026年4月時点の npm 最新 |
| `zod` | **`^3.23.0` で固定 / v4 不可** | SDK ≤1.17.5 で v4 互換性問題 |
| `zod-to-json-schema` | `^3.x` | |
| `dompurify` | `^3.4.1` | Trusted Types 統合済み |

### 1.4 `_meta` キーのパターン (両ディレクトリ互換)

```ts
_meta: {
  // 標準 MCP Apps
  ui: { resourceUri: "ui://ssw-search/mcp-app.html" },
  // ChatGPT Apps SDK 互換 alias
  "openai/outputTemplate": "ui://ssw-search/mcp-app.html",
  "openai/toolInvocation/invoking": "公式情報を確認中…",
  "openai/toolInvocation/invoked": "結果を表示しました。",
  "openai/widgetAccessible": true,
  "openai/resultCanProduceWidget": true,
  annotations: { readOnlyHint: true, idempotentHint: true,
                  openWorldHint: false, destructiveHint: false }
}
```

`_meta["ui/resourceUri"]` (flat key) は **deprecated** — 必ず nested `_meta.ui.resourceUri` を使用。

---

## 4章 — TypeScript / Vite 設定 (Sprint 1 即適用)

### 4.1 `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedSideEffectImports": true
  }
}
```

UI 側は `module: "Preserve" / moduleResolution: "Bundler" / noEmit: true / lib: ["ES2022", "DOM", "DOM.Iterable"] / jsx: "react-jsx"`。

### 4.2 `apps/server/package.json` (依存ピン込み)

```json
{
  "name": "@ssw/server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:stdio": "MCP_TRANSPORT=stdio tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@modelcontextprotocol/ext-apps": "^1.6.0",
    "@google-cloud/discoveryengine": "^2.0.0",
    "@google-cloud/secret-manager": "^5.6.0",
    "@google-cloud/dlp": "^5.0.0",
    "@google-cloud/pino-logging-gcp-config": "^1.x",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-node": "^0.55.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.55.0",
    "express": "^4.21.0",
    "pino": "^9.5.0",
    "zod": "^3.23.0",
    "zod-to-json-schema": "^3.23.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.0",
    "@modelcontextprotocol/inspector": "^0.x",
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

### 4.3 Vite 多 UI ビルド (per-UI workspace)

各 UI を個別の workspace パッケージとし Turborepo で並列ビルド。

`ui/ssw-search/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, "mcp-app.html"),
      output: { inlineDynamicImports: true }
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild"
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") }
});
```

---

## 5章 — ツール実装 (annotations + structured content + observability)

### 5.1 サンプル: `search_visa` (Sprint 1 ドロップイン)

`apps/server/src/tools/search-visa/schema.ts`:

```ts
import { z } from "zod";

export const SearchVisaInput = z.object({
  category: z.enum(["tokutei_ginou_1", "tokutei_ginou_2", "ginou_jisshu",
                    "gijinkoku", "kazokutaizai", "other"])
              .describe("在留資格カテゴリ"),
  industry: z.enum(["agriculture", "fishery", "food_service", "manufacturing",
                    "construction", "nursing_care", "building_cleaning",
                    "automobile_repair", "aviation", "lodging", "shipbuilding",
                    "electronics", "other"]).optional()
              .describe("特定技能の対象産業分野"),
  // PII guard: 年月のみ。日付の細粒度は受けない
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
              .describe("入国・申請予定の年月 (YYYY-MM 形式)"),
  language: z.enum(["ja", "en", "id"]).default("ja")
              .describe("出力言語: 日本語/英語/インドネシア語")
}).strict();
export type SearchVisaInput = z.infer<typeof SearchVisaInput>;

export const SearchVisaOutput = z.object({
  results: z.array(z.object({
    title: z.string(),
    snippet: z.string(),
    sourceUrl: z.string().url(),
    sourceType: z.literal("primary_source"),
    sourceDate: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  disclaimer: z.string(),
  asOf: z.string()
});
```

`apps/server/src/tools/search-visa/handler.ts`:

```ts
import { instrumentTool } from "../../otel.js";
import { logger } from "../../logger.js";
import { scrubInputForPII } from "../../pii/index.js";
import { vertexSearch } from "../../vertex.js";
import { SearchVisaInput, SearchVisaOutput } from "./schema.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const DISCLAIMER_BY_LANG = {
  ja: "本回答は一般情報の提供であり、法律相談・行政書士業務には該当しません。" +
      "個別の手続きについては行政書士・弁護士・登録支援機関にご相談ください。" +
      "最新情報は出入国在留管理庁 (https://www.moj.go.jp/isa/) でご確認ください。",
  en: "This is general information only and does not constitute legal advice or " +
      "gyoseishoshi services under Japanese law (Gyoseishoshi-hō §1-2/§1-3). " +
      "For individual cases, consult a certified gyoseishoshi or attorney. " +
      "Authoritative source: https://www.moj.go.jp/isa/",
  id: "Informasi ini hanya bersifat umum dan bukan nasihat hukum. " +
      "Untuk kasus individu, silakan berkonsultasi dengan gyoseishoshi/pengacara/ " +
      "organisasi pendukung terdaftar. Sumber resmi: https://www.moj.go.jp/isa/"
} as const;

export const searchVisa = instrumentTool("search_visa", async (rawArgs: unknown): Promise<CallToolResult> => {
  const args = SearchVisaInput.parse(rawArgs);
  const piiCheck = await scrubInputForPII(args);
  if (piiCheck.blocked) {
    logger.warn({ tool: "search_visa", reason: "pii_blocked", findings: piiCheck.types });
    return {
      isError: true,
      content: [{ type: "text", text:
        "個人情報 (在留番号・パスポート番号・マイナンバー等) は入力できません。" +
        "一般的な質問のみ受け付けます。" }]
    };
  }
  const t0 = performance.now();
  const grounded = await vertexSearch({
    query: buildQuery(args), datastore: "visa_legal",
    confidenceThreshold: 0.7, sourceAllowlist: ["*.go.jp"]
  });
  if (grounded.chunks.length === 0) {
    return {
      content: [{ type: "text", text:
        "公式情報源で該当する内容が見つかりませんでした。" +
        "出入国在留管理庁公式サイト (https://www.moj.go.jp/isa/) をご確認ください。" }]
    };
  }
  const payload = SearchVisaOutput.parse({
    results: grounded.chunks.map(c => ({
      title: c.title, snippet: c.snippet, sourceUrl: c.uri,
      sourceType: "primary_source", sourceDate: c.publishedAt,
      confidence: c.confidence
    })),
    disclaimer: DISCLAIMER_BY_LANG[args.language],
    asOf: new Date().toISOString().slice(0, 10)
  });
  logger.info({ tool: "search_visa", duration_ms: performance.now() - t0,
                result_count: payload.results.length, status: "ok" });
  return {
    content: [{ type: "text",
      text: `${payload.results.length}件の公式情報源を検出 (${payload.asOf}時点)\n` +
            payload.disclaimer }],
    structuredContent: payload
  };
});
```

`apps/server/src/tools/search-visa/index.ts`:

```ts
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { SearchVisaInput } from "./schema.js";
import { searchVisa } from "./handler.js";

export function registerSearchVisaTool(server: any) {
  registerAppTool(server, "search_visa", {
    title: "Search Japanese visa procedures",
    description:
      "Returns Japanese Specified Skilled Worker (特定技能) and related visa " +
      "procedures grounded in 出入国在留管理庁 official documents. " +
      "Use when the user asks about visa categories, document checklists, or " +
      "deadlines. Information only — does not constitute legal advice.",
    inputSchema: SearchVisaInput.shape,
    annotations: {
      readOnlyHint: true, idempotentHint: true,
      openWorldHint: false, destructiveHint: false
    },
    _meta: {
      ui: {
        resourceUri: "ui://ssw-search/mcp-app.html"
      },
      "openai/outputTemplate": "ui://ssw-search/mcp-app.html",
      "openai/toolInvocation/invoking": "公式情報源を確認中…",
      "openai/toolInvocation/invoked": "結果を表示しました",
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true
    }
  }, searchVisa);
}
```

### 5.2 OpenTelemetry instrumentation helper

`apps/server/src/otel.ts`:

```ts
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";
const tracer = trace.getTracer("ssw-mcp", "1.0.0");

export function instrumentTool<T>(name: string, fn: (args: unknown) => Promise<T>) {
  return async (args: unknown): Promise<T> =>
    tracer.startActiveSpan(`tools/call ${name}`, { kind: SpanKind.SERVER }, async (span) => {
      span.setAttributes({
        "mcp.method.name": "tools/call",
        "gen_ai.tool.name": name,
      });
      const t0 = performance.now();
      try {
        const result = await fn(args);
        span.setAttribute("mcp.tool.duration_ms", performance.now() - t0);
        return result;
      } catch (e: any) {
        span.recordException(e);
        span.setAttribute("error.type", e.code ?? "INTERNAL");
        span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
        throw e;
      } finally {
        span.end();
      }
    });
}
```

---

## 6章 — UI Resource (App class + a11y + i18n)

### 6.1 サンプル: `ui/ssw-search/src/main.tsx`

```tsx
import { App, PostMessageTransport, applyDocumentTheme,
         applyHostStyleVariables, applyHostFonts }
  from "@modelcontextprotocol/ext-apps";
import DOMPurify from "dompurify";
import type { z } from "zod";
import type { SearchVisaOutput } from "@ssw/shared-types";

type Result = z.infer<typeof SearchVisaOutput>;

const i18n = {
  ja: { sources: "公式情報源", disclaimer: "情報提供のみ — 法律相談ではありません",
        asOf: "情報基準日", openSource: "原典を開く" },
  en: { sources: "Official sources", disclaimer: "Information only — not legal advice",
        asOf: "As of", openSource: "Open source" },
  id: { sources: "Sumber resmi", disclaimer: "Informasi saja — bukan nasihat hukum",
        asOf: "Per tanggal", openSource: "Buka sumber" }
} as const;

const purify = DOMPurify.sanitize;
const allowedHrefRe = /^https:\/\/(www\.)?(moj|mhlw|soumu|cao)\.go\.jp\//;

function render(result: Result, lang: "ja"|"en"|"id") {
  const t = i18n[lang];
  const root = document.getElementById("root")!;
  const safeHtml = result.results.map(r => {
    const safeUrl = allowedHrefRe.test(r.sourceUrl) ? r.sourceUrl : "#";
    return `<article class="card" tabindex="0" aria-label="${escapeAttr(r.title)}">
      <h3>${purify(r.title)}</h3>
      <p>${purify(r.snippet)}</p>
      <a href="${escapeAttr(safeUrl)}" rel="noopener" target="_blank">${t.openSource}</a>
      <small>${t.asOf}: ${purify(r.sourceDate)}</small>
    </article>`;
  }).join("");
  root.innerHTML = purify(
    `<section aria-labelledby="h"><h2 id="h">${t.sources}</h2>${safeHtml}</section>
     <p role="note" class="disclaimer">${t.disclaimer}</p>
     <small>${t.asOf}: ${result.asOf}</small>`,
    { ALLOWED_URI_REGEXP: allowedHrefRe, RETURN_TRUSTED_TYPE: true }
  );
}
function escapeAttr(s: string) {
  return s.replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
}

const app = new App({ name: "SSW", version: "1.0.0" });
let currentLang: "ja"|"en"|"id" = "ja";
app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.locale?.startsWith("ja")) currentLang = "ja";
  else if (ctx.locale?.startsWith("id")) currentLang = "id";
  else currentLang = "en";
};
app.ontoolinput = (params) => { /* show skeleton — see v3 §20 */ };
app.ontoolresult = (result) => {
  if (result.structuredContent) render(result.structuredContent as Result, currentLang);
};
app.onteardown = async () => ({});
await app.connect(new PostMessageTransport());
```

### 6.2 CSP (singlefile 対応 + Trusted Types)

`mcp-app.html` `<head>`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'sha256-{COMPUTED_AT_BUILD}' 'strict-dynamic';
  style-src 'sha256-{COMPUTED_AT_BUILD}';
  img-src 'self' data:;
  font-src 'self' data:;
  connect-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'none';
  require-trusted-types-for 'script';
  trusted-types ssw-purify;
">
```

サーバーは `_meta.ui.csp` を別途宣言:

```ts
registerAppResource(server, "ssw-search-ui",
  "ui://ssw-search/mcp-app.html",
  { description: "SSW search UI" },
  async () => ({ contents: [{
    uri: "ui://ssw-search/mcp-app.html",
    mimeType: "text/html;profile=mcp-app",
    text: await loadHtml("ssw-search"),
    _meta: { ui: {
      prefersBorder: true,
      csp: {
        connectDomains: [],
        resourceDomains: [],
        frameDomains: [],
        baseUriDomains: []
      }
    } }
  }] }));
```

---

## 7章 — PII Guard / 入力検証 (DLP API 統合)

### 7.1 二段防御 (regex pre-filter + Cloud DLP authoritative)

`apps/server/src/pii/index.ts`:

```ts
import { DlpServiceClient } from "@google-cloud/dlp";
const dlp = new DlpServiceClient();

const REGEX = {
  zairyu: /\b[A-Z]{2}[0-9]{8}[A-Z]{2}\b/,           // 在留カード番号
  myNumber: /\b\d{12}\b/,                             // 個人番号
  passport: /\b[A-Z]{1,2}\d{7}\b/,                   // 旅券番号
  email: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/,
  phone: /(?:\+?81|0)\d{1,4}-?\d{1,4}-?\d{3,4}/
};
const HOTWORDS = ["在留カード", "residence card", "マイナンバー", "個人番号",
                  "旅券", "passport", "氏名", "本名"];

const BLOCKING_TYPES = new Set([
  "JAPAN_INDIVIDUAL_NUMBER", "JAPAN_PASSPORT",
  "JAPAN_DRIVERS_LICENSE_NUMBER", "ZAIRYU_CARD_NUMBER",
  "CREDIT_CARD_NUMBER"
]);

export async function scrubInputForPII(args: unknown):
  Promise<{ blocked: boolean; types: string[] }> {
  const text = JSON.stringify(args);
  const regexHits: string[] = [];
  if (REGEX.zairyu.test(text)) regexHits.push("ZAIRYU_CARD_NUMBER");
  if (REGEX.myNumber.test(text) && HOTWORDS.some(h => text.includes(h)))
    regexHits.push("JAPAN_INDIVIDUAL_NUMBER");
  if (REGEX.passport.test(text)) regexHits.push("JAPAN_PASSPORT");
  if (regexHits.some(t => BLOCKING_TYPES.has(t)))
    return { blocked: true, types: regexHits };
  const [resp] = await dlp.inspectContent({
    parent: `projects/${PROJECT}/locations/asia-northeast1`,
    inspectConfig: {
      infoTypes: [
        { name: "JAPAN_INDIVIDUAL_NUMBER" }, { name: "JAPAN_PASSPORT" },
        { name: "JAPAN_DRIVERS_LICENSE_NUMBER" }, { name: "EMAIL_ADDRESS" },
        { name: "PHONE_NUMBER" }, { name: "CREDIT_CARD_NUMBER" }
      ],
      customInfoTypes: [{
        infoType: { name: "ZAIRYU_CARD_NUMBER" },
        regex: { pattern: "\\b[A-Z]{2}[0-9]{8}[A-Z]{2}\\b" },
        likelihood: "VERY_LIKELY"
      }],
      minLikelihood: "LIKELY", includeQuote: false
    },
    item: { value: text }
  });
  const dlpHits = (resp.result?.findings ?? [])
    .map(f => f.infoType?.name ?? "")
    .filter(n => BLOCKING_TYPES.has(n));
  return { blocked: dlpHits.length > 0, types: [...regexHits, ...dlpHits] };
}
```

### 7.2 入力 schema レベルの guard

- 文字列フィールドに **max length 500** 制約
- 列挙型を多用 — 自由記述を最小化
- `args` 全体を log しない (logger redact `["*.email","*.passport","*.dob","*.phone","args"]`)

---

## 8章 — Cloud Run / インフラ (BYOSA + Cloud Armor + Cloudflare)

### 8.1 多層防御アーキテクチャ

```
[User] → [Cloudflare WAF + DDoS + Bot Fight + Geo-block]
       → [GCP External HTTPS LB + Cloud Armor (rate limit + reCAPTCHA WAF)]
       → [Cloud Run (asia-northeast1, --allow-unauthenticated, max-instances=20)]
       → [Vertex AI Search (BYOSA, least privilege)]
       → [Secret Manager (volume mount, version-pinned)]
```

### 8.2 BYOSA (Bring-Your-Own-Service-Account) — 必須

```
ssw-runtime@<project>.iam.gserviceaccount.com
  ├── roles/aiplatform.user                (publisher 条件で scoped)
  ├── roles/discoveryengine.viewer         (visa_legal/visa_faq/visa_secondary 限定)
  ├── roles/secretmanager.secretAccessor   (specific secret resources)
  ├── roles/cloudtrace.agent
  └── roles/logging.logWriter
```

**禁止:** `Editor` / `Owner` / project-wide role / default compute SA。**Workload Identity Federation** で GitHub Actions → WIF pool → SA impersonation。

### 8.3 Terraform module 構造

```
infra/terraform/
├── main.tf
├── modules/
│   ├── cloudrun/
│   ├── cloud-armor/
│   ├── service-account/       # BYOSA + IAM least-privilege
│   ├── secret-manager/
│   ├── vertex-ai-search/
│   └── logging/
├── envs/
│   ├── prod/
│   └── staging/
└── variables.tf
```

### 8.4 Secret 管理

- **Secret Manager + Volume mount** (env var 不可)
- **Version pinned** (`projects/X/secrets/Y/versions/3`) — `:latest` 不可
- Vertex AI 自体は API key 不要 (runtime SA のみ)

---

## 9章 — Audit Logging (PII 漏洩なし)

### 9.1 ログ対象マトリクス

| カテゴリ | Log する | Log しない |
|---|---|---|
| ツール呼び出し | tool_name, request_id, session_hash, latency_ms, result_class | raw input, full args, response text |
| Vertex AI Search | doc_id, confidence, retrieval_count | snippet text |
| PII 検出 | hit infoType 名と件数 | 一致した実値 |
| HTTP layer | status, response_size, Cloud Armor 判定 | full URL with query string |

### 9.2 Retention

- アプリログ (_Default): **30 日**
- セキュリティログ: **400 日 + Bucket Lock**
- DLP findings + tool error events: **90 日 + Bucket Lock**

### 9.3 Pino + GCP 連携

```ts
// apps/server/src/logger.ts
import pino from "pino";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";

export const logger = pino(createGcpLoggingPinoConfig(
  { serviceContext: { service: "ssw-mcp",
                       version: process.env.K_REVISION ?? "dev" } },
  { level: process.env.LOG_LEVEL ?? "info",
    redact: { paths: ["*.email","*.passport","*.dob","*.phone","*.zairyu","args","input","query"],
              censor: "[REDACTED]" } }
));
```

---

## 10章 — Vertex AI Search Grounding 整合性

**Grounding mode を採用** — model に citation 強制、`groundingMetadata.confidence_scores` を返す。

**Confidence threshold 0.7** 未満の chunk は破棄し、結果が 0 件なら refuse-and-redirect (「公式情報源で該当する内容が見つかりませんでした」 + moj.go.jp/isa リンク)。

**Source allowlist** — `groundingChunks[].source.uri` を `*.go.jp` ドメイン正規表現で検証。

**Data store 整合性:**
- **Content hashing**: 各文書の SHA-256 を Firestore に保存 → 週次 re-scrape で diff alarm
- **Source allowlist**: ingestion パイプラインも `*.go.jp` 限定
- **月次 行政書士監修**: 法改正反映の体制

---

## 11章 — 行政書士法 §19-1 防衛 (最重要)

### 11.1 2026年1月1日施行 改正の要点

**改正条文:** *「行政書士又は行政書士法人でない者は、他人の依頼を受け、いかなる名目によるかを問わず報酬を得て、業として第一条の三に規定する業務を行うことができない。」*

**罰則:** §21 → 1 年以下の拘禁刑 or 100 万円以下の罰金、§23-3 両罰規定で **法人 100 万円以下**。

### 11.2 SSW Public の 3 防衛線

**第 1 線 — 構造的防衛 (アーキテクチャ):**
- **完全無償** (フリーミアム化禁止)
- **Sugukuru 有償人材紹介事業からの独立 SKU**
- **個別具体性の遮断**: 申請書/理由書の draft 生成・特定個人の事案に対する個別判断を**禁止**

**第 2 線 — 文言的防衛 (Disclaimer):**

毎ページ表示 (footer):
```
本サービスは、出入国在留管理庁の公開情報及び一般公表されている法令解釈を
基にした一般的な情報提供のみを目的とするものであり、特定の事案に対する
法律相談・行政書士業務(行政書士法第1条の2、第1条の3)には該当しません。
個別の在留資格申請手続については、必ず行政書士又は弁護士にご相談ください。
本サービスの情報は予告なく変更される場合があり、その正確性・最新性を
保証するものではありません。
```

LLM 応答末尾 (programmatic 強制注入):
```
※本回答は一般情報のみ。個別の手続きについては行政書士又は弁護士にご相談ください。
※最新情報は出入国在留管理庁(https://www.moj.go.jp/isa/)で確認してください。
```

**第 3 線 — 運用的防衛:**
- 顧問 行政書士 1 名 retainer 契約 → 月次でデータストア内容と LLM 応答サンプルをレビュー
- 入管法 §73-2 (不法就労助長) 抵触クエリ検出
- インシデント対応 runbook

### 11.3 個人情報保護法 (APPI) 適用範囲

1. 利用目的: 「サービス提供のための一時的な技術ログ」を **privacy policy で明示**
2. **24h 以内に IP を HMAC-SHA256(IP+UA+daily salt) に置換**
3. **越境移転回避**: Cloud Run region を `asia-northeast1` (Tokyo) で固定
4. **要配慮個人情報** のクエリ投入を DLP filter で **reject**
5. 開示・訂正・利用停止請求の窓口メールを privacy policy に明示
6. **データ漏洩時 72h 通知** (PPC + 本人) — IR runbook を整備

---

## 13章 — CI/CD (GitHub Actions + Cloud Build + WIF)

### 13.1 GitHub Actions (Sprint 1 ドロップイン)

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build
      - name: MCP Inspector smoke test
        run: |
          npx @modelcontextprotocol/inspector --cli \
            node apps/server/dist/index.js --method tools/list \
            > tools-list.json
          jq -e '.tools | length >= 3' tools-list.json
      - name: UI bundle size budget
        run: |
          for f in ui/*/dist/mcp-app.html; do
            size=$(wc -c < "$f")
            [ "$size" -lt 524288 ] || { echo "$f exceeds 512KB"; exit 1; }
          done
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: validate
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ssw-deploy@${{ secrets.PROJECT }}.iam.gserviceaccount.com
      - uses: google-github-actions/setup-gcloud@v2
      - name: Cloud Build deploy
        run: |
          gcloud builds submit --config cloudbuild.yaml \
            --substitutions=_REGION=asia-northeast1
```

### 13.2 リリース戦略 / バージョニング

- **MCP server SemVer**: tool 追加 = minor, tool description 変更 = patch, schema 破壊変更 = major
- **Tool deprecation**: deprecated tool は `description` 冒頭に `[DEPRECATED — use X]` を記載、3 ヶ月後に削除
- **Canary / traffic split**: Cloud Run `traffic` を 10% canary → 100% 段階的に

---

## 14章 — ディレクトリ提出 (Anthropic + OpenAI 並行)

### 14.1 Anthropic 必須チェックリスト

- [x] HTTPS + Origin-header validation
- [x] Streamable HTTP (SSE 不可)
- [x] 全 tool に `readOnlyHint`, `destructiveHint`, `title`
- [x] tool 名 ≤ 64 文字
- [x] graceful error handling, token-frugal responses
- [x] Privacy policy URL (HTTPS, 公開)
- [x] 動作確認用 example prompts × 3
- [x] テスト用アクセス手順
- [x] Branding: logo, favicon, screenshots
- [x] 不許可カテゴリ非該当
- [x] Hidden/encoded instruction 不在

### 14.2 OpenAI 追加要件

- [x] Org/個人の identity 検証 (Owner role 必須)
- [x] **CSP の明示宣言** が submission 必須
- [x] App Manifest: name, logo, description, company URL, privacy policy URL, MCP URL, screenshots
- [x] tool description が「他 app より優先」「他 app を貶す」言及をしない

### 14.3 Marketing copy

- **タグライン (≤ 8 語):** *"The compass for Japanese visa procedures."*
- **詳細 (≤ 25 語):** *"SSW Compass grounds your Japanese SSW visa questions in 出入国在留管理庁 official sources."*
- **Example prompts × 3:**
  1. *"インドネシア人で農業の特定技能 1 号を取りたい。必要書類は?"*
  2. *"特定技能 2 号と 1 号の違いは?"*
  3. *"在留資格認定証明書交付申請の処理期間と必要書類を教えて"*

---

## 15章 — 観測性 / 障害復旧 / Feature Flag

### 15.1 OpenTelemetry semconv 準拠

OTel 公式 MCP semantic conventions に準拠 — `mcp.method.name`, `gen_ai.tool.name`, `error.type`。

### 15.2 SLO / アラート

- Tool call p95 latency < 3s (Vertex AI Search 込)
- Error rate < 1% (5 分 window)
- Cost: Vertex AI Search 月次予算 ¥500k 上限、80% 到達で alert
- Cloud Armor block rate spike (>10× baseline) で alert

### 15.3 Feature Flag / A/B Testing

**Firestore-backed feature flag 単純実装** で十分。フラグ例: `disclaimer_full_v2`、`ui_design_mode`、`vertex_confidence_threshold`。

### 15.4 Error Reporting

Cloud Error Reporting に Pino の `error` 以上を自動 ingestion (pino-logging-gcp-config が GCP 形式で出力)。

---

## 17章 — リスクレジスタ

| # | リスク | 確率 | 影響 | 主な緩和策 |
|---|---|---|---|---|
| R1 | 行政書士法違反認定 | 中→高 | 致命 | 完全無償 / 独立 SKU / 顧問監修 / 三層 disclaimer |
| R2 | LLM01 Prompt Injection | 高 | 中 | Output filter + confidence threshold |
| R3 | LLM04 Data Poisoning | 中 | 高 | Content hashing + 月次行政書士監修 + domain allowlist |
| R4 | LLM10 Unbounded Consumption | 高 | 高 | Cloudflare + Cloud Armor + max-instances=20 |
| R5 | LLM09 Misinformation | 高 | 致命 | Confidence ≥0.7 / refuse-and-redirect / 引用必須 |
| R6 | Vertex AI 過剰権限 (Unit 42 公表) | 中 | 高 | BYOSA + roles/discoveryengine.viewer scoped |
| R7 | postMessage 仕様非準拠 | 中 | 高 | 1.1 仕様準拠化 — Sprint 1 必須 |
| R8 | Zod v4 / SDK incompat | 低 | 中 | zod ^3.23 ピン |
| R9 | APPI 違反 | 低 | 中 | Privacy policy + 24h IP HMAC + asia-northeast1 |
| R10 | サンドボックス内 mXSS | 低 | 中 | DOMPurify 3.4.1 + Trusted Types + CSP hash |
| R11 | Directory rejection | 低 | 中 | Sprint 1 で全 tool に annotations |
| R12 | 競合参入 | 中 | 中 | First-mover 速度 / 行政書士監修体制 |
| R13 | 入管法 §73-2 不法就労助長 | 低 | 致命 | Output filter で不正パターンを refuse |
| R14 | Secret 漏洩 | 低 | 高 | Secret Manager volume mount / WIF |
| R15 | DDoS / scraping | 高 | 中 | Cloudflare + Cloud Armor 多段 |

---

## 結論

本書は土台、v3 は強化と言い換え。両方を Cursor Agent に context として与え、競合した場合は v3 を優先。Sprint 1 では `tsconfig` / `package.json` / `vite.config.ts` / 1 つの tool ハンドラ / 1 つの UI / `.cursor/rules` / GitHub Actions まで、本書のサンプルを直接 Cursor に投入して走らせれば 1 週間以内に staging 動作可能。

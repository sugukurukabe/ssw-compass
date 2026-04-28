# Sprint 4 Plan — フリーミアム × HITL × キラー機能

> **Period**: Sprint 4 (2026年6-7月、3週間実働 ≒ 21日)
> **Status**: Planned
> **Author**: 壁 (Sugukuru K.K. CEO/CTO), 2026-04-28
> **Input docs**: v4-supplement.md / v3-supplement.md / v2-comprehensive-design.md / ADR-001〜012 / sprint-3-summary.md / .cursor/rules/

---

## 0. Sprint 4 ゴール

Sprint 4 完走の定義 (v4 §10.3 revised):

- [ ] **G1**: v3 既存 92 テスト pass 維持
- [ ] **G2**: v4 新規テスト ≥ 30 件 pass (目標 ~144 件)
- [ ] **G3**: 6-host manual verification 最低 2 (Claude Desktop + Claude Web)
- [ ] **G4**: ADR-011 / 013 / 014 / 015 / 017 / 018 / 020 確定 (ADR-016 は target、not blocker)
- [ ] **G5**: キラー機能 #1 / #2 / #4 / #6 / #8 が staging で動作確認
- [ ] **G6**: prod Cloud Run + LB + Cloud Armor + custom domain (`mcp.ssw-compass.jp`) + CSP enforce 全 green
- [ ] **G7**: Cloud Logging 24h ERROR rate < 0.1%
- [ ] **G8 (Sprint 5 Phase A)**: Submission packet (logo / video / privacy policy / license / Directory 提出) は Sprint 5 に分離

---

## 1. Design issues (Part 1 結果)

Sprint 4 着手ブロッカー (Batch 1 で解消必須):

| ID | 内容 | 解消 Batch |
|---|---|---|
| C1 | MCP SDK `server/auth/provider.js` の実在性 (1.29 未確認) | B1 実機 import 検証 |
| C2 | Cloud Run ingress と Free anonymous の矛盾 (ADR-012 allow_unauth=false) | B2 ADR-013 で 3-path 評価 |
| U1 | `SSW_16_INDUSTRIES` enum 未定義 (名前に数字を含めない) | B1 SSW_INDUSTRIES_ACTIVE 確定 |
| U2 | case_id 生成仕様 (生成主体・library) | B3 ADR-014 で確定 |
| U3 | Firestore 依存の有無 | B6 ADR-015 でデフォルト不採用確定 |
| U4 | LawUpdate interface 単一 SSOT が無い | B7 packages/shared-types で確立 |
| U5 | Reverse Trial state machine → Sprint 5 送り | Phase 0 で future-ready field のみ先置き |
| U6 | 10 言語 grounding 品質保証 | B8 ADR-018 で段階的 rollout 確定 |

**外部確認必須 (D1-D12)** — Batch 1 で一次ソース確認、確認できない項目は `status: "pending_verification"`:

| ID | 確認項目 | 一次ソース |
|---|---|---|
| D1 | 改正行政書士法 §19 施行日 (2026/1/1) | e-Gov `lawid=326AC1000000004` |
| D2 | 入管法 §73-2 施行日 (2026/6/14) | moj.go.jp/isa |
| D3 | 特定技能 正式分野数 | moj.go.jp/isa/policies/ssw |
| D7 | SDK auth API 公開 version | github.com/modelcontextprotocol/typescript-sdk Releases |
| D8/D9 | Connectors Directory / OpenAI Apps SDK 提出要件 最新版 | Anthropic / OpenAI 公式 |
| D4-D6, D10-D12 | 外食業停止 / 手数料改定 / 育成就労 他 | 各所管省庁 (TBD 許容) |

---

## 2. Batch 分割 (Part 2)

**スケジュール**: 12 Batch (B1-B11 が Sprint 4 本体、B12 = Sprint 5 Phase A へ defer)

| Batch | Phase | タイトル | 日数 | ADR | 依存 |
|---|---|---|---:|---|---|
| **B1** | 0 | Pre-flight (SDK + ADR audit + 一次ソース + license) | 1 | — | — |
| **B2** | 0 | ADR-013 Auth 3-path + 実装 | 2 | ADR-013 | B1 |
| **B3** | 0 | ADR-014 HITL lockgate + tool annotation | 2 | ADR-014 | B2 |
| **B4** | 1 | ADR-011 DLP sanitizer 本書き | 1 | ADR-011 | B3 |
| **B5** | 1 | Vertex content ingestion + real flip (**parallel-track / target**) | 3 | ADR-016 | B4 |
| **B6** | 1 | ADR-015 Audit log 7年 (GCS only) | 2 | ADR-015 | B3+B5 |
| **B7** | 1 | LawUpdate SSOT + 制度変動 fixture | 2 | — | B1+B6 |
| **B8** | 2 | Killer #1 + #8 (search 10言語 + deadline gantt) | 3 | ADR-018 | B3+B5+B7 |
| **B9** | 2 | Killer #2 + #4 (list_law_updates + docs PDF/CSV) | 3 | ADR-020 | B3+B7+B8 |
| **B10** | 2 | Killer #6 + #9 partial (approval + 派遣 2分野) | 3 | ADR-017 | B3+B6+B8+B9 |
| **B11** | 3 | prod deploy + LB + Cloud Armor + CSP enforce | 3 | — | B10 |
| **B12** | Sprint 5A | Submission packet (defer) | — | ADR-021? | B11 |

**並行実行**: B4‖B5‖B6‖B7 は B3 完了後に同時起動可能。B5 は killer features の critical-path から外れている (revision 3)。

**Batch 5 parallel-track policy**: B8/B9/B10 の handler は Path B (search-lite + fixture) で完全動作し、Vertex real flip は target / not blocker。

---

## 3. Interface Freeze (Part 3)

Sprint 4 全期間で変更不可の公開 API。Cursor はこれらを変更する前に必ず人間に escalate する。

### 3.1 Auth (B2 / ADR-013)

```typescript
// packages/shared-types/src/auth/AuthContext.ts
export const AuthTier = z.enum(["free", "pro", "business"]);
export type AuthTier = z.infer<typeof AuthTier>;

export const AuthContext = z.object({
  user_id: z.string().min(1).max(128),
  tier: AuthTier,
  gyoseishoshi_verified: z.boolean(),
  gyoseishoshi_number: z.string().regex(/^[\u4e00-\u9fa5]+ \d+$/).optional(),
  auth_source: z.enum(["anonymous", "jwt", "oauth_client_credentials"]),
  issued_at: z.number().int().nonnegative(),
}).strict();
export type AuthContext = z.infer<typeof AuthContext>;
```

ADR-013 で評価する 3 path:

| Path | SDK 依存 | Cloud Run ingress | Free tier |
|---|---|---|---|
| X: SDK TokenVerifier | ^1.29+ (B1 確認) | auth-gated | SDK anonymous scope |
| Y: application-layer JWT | 不要 | auth-gated | middleware bypass |
| Z: OAuth Client Credentials + "free_public" scope | 不要 | auth-gated | scope=free_public |

### 3.2 HITL (B3 / ADR-014)

```typescript
// packages/shared-types/src/hitl/HitlControl.ts
export const HitlControlId = z.enum([
  "H01_DRAFT_LOCKGATE", "H02_DRAFT_WATERMARK", "H03_GYOSEISHOSHI_APPROVAL",
  "H04_AUDIT_LOG_7Y", "H05_HALLUCINATION_NOTICE", "H06_ILLEGAL_WORK_ALERT",
  "H07_PII_AUTO_MASKING", "H08_DOUBLE_CONFIRM", "H09_TEMPLATE_VS_INDIVIDUAL",
  "H10_LAW_AUTO_UPDATE", "H11_FEE_TRANSPARENCY", "H12_LIABILITY_CLAUSE",
]);
export type HitlControlId = z.infer<typeof HitlControlId>;

export const LegalLevel = z.enum(["L0", "L1", "L2", "L3"]); // L4 実装しない
export type LegalLevel = z.infer<typeof LegalLevel>;

// v2 §8.3 既存フィールドは破壊しない。v4 追加フィールドのみ。
export interface SswCompassToolAnnotation {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
  readonly title: string;
  readonly legalLevel: LegalLevel;
  readonly requiresGyoseishoshiAuth: boolean;
  readonly hitlControls: readonly HitlControlId[];
  readonly tier: "free" | "pro" | "business";
}
```

```typescript
// apps/server/src/hitl/lockgate.ts
export class HitlGateError extends Error {
  constructor(
    public readonly controlId: HitlControlId,
    public readonly userMessage: string,
    public readonly statusCode: 403 | 401 = 403,
  ) { super(userMessage); this.name = "HitlGateError"; }
}

export function assertHitlGate(
  auth: AuthContext | null, toolId: string, legalLevel: LegalLevel,
): asserts auth is AuthContext;

// Per-call escalation (ADR-014 §Per-call escalation)
export function assertHitlGateRuntime(
  auth: AuthContext | null, toolId: string,
  staticLevel: LegalLevel, runtimeLevel: LegalLevel,
): asserts auth is AuthContext;

export const LOCKGATE_MESSAGE_JA =
  "この機能は Pro 以上の行政書士アカウントで認証されたユーザーのみ利用できます。" +
  "個別具体の書類作成は、改正行政書士法§19 (2026年1月1日施行) により" +
  "行政書士または行政書士法人のみが業として行えます。\n" +
  "- Pro へのアップグレード: https://ssw-compass.jp/upgrade\n" +
  "- 行政書士をお探しの方: https://ssw-compass.jp/find-gyoseishoshi";
```

**Per-call escalation table (ADR-014 §Per-call escalation)**:

| Tool | Static | Escalation input | Effective |
|---|---|---|---|
| list_visa_documents | L1 | output_format ∈ {"pdf_draft","csv"} | L2 |
| search_visa | L0 | (なし) | L0 |
| get_deadline_timeline | L1 | (なし) | L1 |
| classify_procedure | L1 | (なし) | L1 |
| list_law_updates | L0 | (なし) | L0 |
| submit_gyoseishoshi_approval | L2 | (なし、常に L2) | L2 |
| validate_zairyu_compatibility | L1 | (なし) | L1 |

### 3.3 Case ID (B3 / ADR-014)

```typescript
// packages/shared-types/src/case-id.ts
// v4 §3.4 honor: /^case_[a-z0-9]{16}$/ (base36-lowercase, ~82-bit entropy)
import { customAlphabet } from "nanoid";

export const CASE_ID_PATTERN = /^case_[a-z0-9]{16}$/;
export const CaseId = z.string().regex(CASE_ID_PATTERN);
export type CaseId = z.infer<typeof CaseId>;

const generateSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);
export function generateCaseId(): CaseId {
  return `case_${generateSuffix()}` as CaseId;
}
```

### 3.4 Audit log (B6 / ADR-015)

```typescript
// packages/shared-types/src/audit/AuditEvent.ts
export const AuditEvent = z.object({
  timestamp: z.string().datetime(),
  actor: z.object({
    user_id_hash: z.string().regex(/^[a-f0-9]{64}$/),
    tier: AuthTier,
    gyoseishoshi_number: z.string().optional(),
  }).strict(),
  action: z.enum([
    "tool_invoked", "draft_approved", "draft_rejected", "pii_blocked",
    "hitl_gate_rejected", "zairyu_compatibility_checked", "document_exported",
  ]),
  case_id: CaseId.optional(),
  tool_id: z.string().regex(/^[a-z_]+$/),
  legal_level: LegalLevel,
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
  output_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  approval_signature: z.object({
    method: z.enum(["checkbox_only", "checkbox_with_seal", "esign"]),
    seal_image_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    ip_address_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict().optional(),
  schema_version: z.literal("v1"),
}).strict();
export type AuditEvent = z.infer<typeof AuditEvent>;
```

```terraform
# infra/terraform/modules/audit-log/main.tf
# retention = 7 × 366 × 86400 = 221,184,000 秒 (leap year safe)
resource "google_storage_bucket" "audit_7y" {
  name                        = "ssw-compass-audit-7y"
  location                    = "asia-northeast1"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  retention_policy {
    retention_period = 221184000
    is_locked        = true
  }
  versioning { enabled = true }
}
```

### 3.5 LawUpdate SSOT (B7)

```typescript
// packages/shared-types/src/law-updates.ts (§3.2 と §6.1 の両方がここから import)
export const LawUpdateCategory = z.enum([
  "fee_revision", "gyoseishoshi_law", "immigration_act",
  "industry_pause", "form_revision", "operational_guidance", "all",
]);
export const AffectingRole = z.enum([
  "gyoseishoshi", "host_company_hr", "dispatch_company", "support_org", "all",
]);
export const ImpactSeverity = z.enum(["info", "minor", "major", "critical"]);
export const LawUpdateStatus = z.enum(["active", "pending", "pending_verification", "withdrawn"]);
export const LawUpdate = z.object({
  id: z.string().regex(/^FY\d{4}-.+$/),
  effective_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("TBD")]),
  announced_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title_ja: z.string().min(1).max(200),
  title_en: z.string().min(1).max(200).optional(),
  title_id: z.string().min(1).max(200).optional(),
  summary_ja: z.string().min(1).max(2000),
  category: LawUpdateCategory.exclude(["all"]),
  affecting_roles: z.array(AffectingRole.exclude(["all"])).min(1),
  impact_severity: ImpactSeverity,
  source_urls: z.array(z.string().url()).min(1),
  status: LawUpdateStatus,
}).strict();
export type LawUpdate = z.infer<typeof LawUpdate>;
```

### 3.6 SSW Industries (B1)

```typescript
// packages/shared-types/src/ssw-industries.ts
// 数字を含まない命名 — 分野数変更時に rename 不要
export const SSW_INDUSTRIES_ACTIVE = [
  // B1 で moj.go.jp 一次ソース確認後に最終値を確定する
  "agriculture", "fishery", "food_manufacturing", "food_service",
  "accommodation", "construction", "shipbuilding", "automobile_maintenance",
  "aviation", "building_cleaning", "manufacturing", "nursing_care",
  "automobile_transportation", "railway", "forestry", "wood_products",
] as const;
export type SswIndustry = typeof SSW_INDUSTRIES_ACTIVE[number];

export const DISPATCH_ALLOWED_INDUSTRIES = ["agriculture", "fishery"] as const;
export type DispatchAllowedIndustry = typeof DISPATCH_ALLOWED_INDUSTRIES[number];
```

### 3.7 i18n (B8)

```typescript
// packages/shared-types/src/i18n/supported-languages.ts
export const SUPPORTED_LANGUAGES = [
  "ja", "en", "id", "zh-CN", "zh-TW", "vi", "tl", "th", "km", "my",
] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Sprint 4 で Vertex grounding が本格品質保証される言語
export const VERTEX_GROUNDED_LANGUAGES = ["ja", "en", "id"] as const;
export type VertexGroundedLanguage = typeof VERTEX_GROUNDED_LANGUAGES[number];
```

### 3.8 v4 拡張 tool schema (B8-B10)

```typescript
// v4 extend (v3 inputSchema は破壊しない)
export const SearchVisaInputV4 = SearchVisaInput.extend({
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
  response_style: z.enum(["concise", "detailed", "stepbystep"]).default("concise"),
  enable_followup_suggestions: z.boolean().default(true),
}).strict();

export const GetDeadlineTimelineInputV4 = GetDeadlineTimelineInput.extend({
  alert_thresholds_days: z.array(z.number().int().positive()).default([14, 30, 60, 90]),
  visualization: z.enum(["gantt_svg", "table", "json"]).default("gantt_svg"),
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
}).strict();

export const DocumentOutputFormat = z.enum(["json", "html_preview", "pdf_draft", "csv"]);
export const ListVisaDocumentsInputV4 = ListVisaDocumentsInput.extend({
  include_omission_conditions: z.boolean().default(true),
  output_format: DocumentOutputFormat.default("json"),
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
}).strict();

export const SubmitGyoseishoshiApprovalInput = z.object({
  case_id: CaseId,
  draft_document_id: z.string().regex(/^doc_[a-z0-9]{16}$/),
  draft_content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  approval_method: z.enum(["checkbox_only", "checkbox_with_seal", "esign"]),
  seal_image_base64: z.string().optional(),
  approver_gyoseishoshi_number: z.string().regex(/^[\u4e00-\u9fa5]+ \d+$/),
  notes: z.string().max(2000).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
}).strict().refine(
  (d) => d.approval_method !== "checkbox_with_seal" || !!d.seal_image_base64,
  { message: "checkbox_with_seal は職印画像必須", path: ["seal_image_base64"] },
);
```

---

## 4. ADR 番号対照 (Part 3 §11)

| ADR | 用途 | 確定 Batch |
|---|---|---|
| ADR-011 | DLP + sanitizer (Sprint 3 reserved → Accepted) | B4 |
| ADR-013 | Auth 3-path 評価 + Cloud Run ingress 確定 | B2 |
| ADR-014 | HITL lockgate + per-call escalation + case_id (nanoid base36) | B3 |
| ADR-015 | Audit log 7年 GCS bucket_lock、Firestore 不採用 | B6 |
| ADR-016 | Vertex fixture ↔ ingestion 境界 (target / not blocker) | B5 |
| ADR-017 | 派遣業 2 分野限定 + SSW_INDUSTRIES_ACTIVE | B10 |
| ADR-018 | 10 言語 i18n + Vertex grounding 段階的 rollout | B8 |
| **ADR-019** | **reserved** — 行政書士登録番号検証 | Sprint 5 |
| ADR-020 | PDF/CSV gating の legal_level 割り当て | B9 |

---

## 5. 検証計画 (Part 4)

### テスト数の目標

| 種別 | 件数 |
|---|---|
| v3 既存 (Sprint 3 baseline) | 92 |
| v4 新規 (Sprint 4 追加) | ~144 |
| **合計 (Sprint 4 close 時)** | **~236** |

### v4 必須最小テスト (gating)

```typescript
// HITL lockgate — 最重要
assertHitlGate: Free × L2 → HitlGateError
assertHitlGate: Pro+gyoseishoshi × L2 → pass
assertHitlGateRuntime: list_visa_documents pdf_draft → L2 escalation → Free reject
assertHitlGateRuntime: list_visa_documents pdf_draft → L2 escalation → Pro accept
validateToolAnnotations: L2 tool without H01 → ConfigError (startup crash)

// Killer features
get_deadline_timeline: Free × cases.length=4 → TierLimitError
list_law_updates: immigration_act filter → FY2026-imm-73-2 が含まれる
submit_gyoseishoshi_approval: audit event emitted BEFORE return
validate_zairyu_compatibility: ryugaku + agriculture → ILLEGAL
assertDispatchAllowed: manufacturing → DispatchNotAllowedError

// i18n
SUPPORTED_LANGUAGES 全 10 言語で disclaimer 注入確認
VERTEX_GROUNDED_LANGUAGES 以外は results=[] + pending_rollout note
```

### Batch exit checklist のポイント

各 Batch はこの順序で exit gate:
1. Interface Freeze 承認 (人間)
2. `pnpm -F @ssw/server test` 全 pass (既存 + Batch 追加分)
3. staging smoke 5 段 pass
4. terraform plan で 意図しない destroy = 0 確認

### 6-host manual verification

**必須 2-host (Sprint 4 close gating)**:

| Batch | Host | 確認内容 |
|---|---|---|
| B8 後 (Day 12) | Claude Desktop | Killer #1 (10 言語) + #8 (gantt SVG) |
| B10 後 (Day 18) | Claude Desktop + Claude Web | #1/2/4/6/8 全機能 + PDF gating |
| B11 後 (Day 21) | 同上 2 host で prod URL | prod smoke + CSP enforce 動作 |

**stretch 4-host** (VS Code Copilot / Goose / Postman / MCPJam): 時間と意欲に応じて、困難なら Sprint 5 Phase B に deferral。

---

## 6. リスクと Tradeoff (Part 5)

### 上位 10 リスク

| # | リスク | 確率 | 影響 | 恒久対策 |
|---|---|---|---|---|
| R1 | SDK auth API 不在で ADR-013 Path 強制変更 | 中 | 高 | B1 実機 import Day 1 |
| R2 | OAuth host 互換性 (Claude Web は PKCE 未対応の可能性) | 高 | 中 | Sprint 4 は JWT bearer token 主、PKCE は Sprint 5 |
| R3 | Vertex real flip が gyoseishoshi 監修で遅延 | 高 | 中 | B5 を parallel-track、B8-10 は Path B で完動 |
| R4 | URL dead rate 悪化 (前回 30%) | 中 | 中 | dry-run で先行確認、best-effort ingest |
| R5 | DLP false-positive 再発 (staging smoke 失敗) | 中 | 低-中 | minLikelihood=LIKELY で調整 |
| R6 | CSP enforce flip で UI 不動作 | 中 | 高 | staging 1 日 soak 後に prod |
| R7 | Cloud Armor rate limit 誤検知 (prod 初日) | 低 | 中 | 72h log 監視、誤検知多発で緩和 hotfix |
| R8 | 派遣 3 書類 gyoseishoshi review NG | 中 | 中 | acceptance = "equivalent to official" (1:1 不要) |
| **R9** | **env var drift (prod deploy)** | **高** | **高** | 1 PR = atomic set (Sprint 3 learning) |
| **R10** | **新 2 UI dist が Docker image に未同梱** | 中 | 中 | Dockerfile を glob COPY パターンに変更 |

### Sprint 3 Hotfix 学習 → Sprint 4 予防

| Sprint 3 bucket | 件数 | Sprint 4 予防策 |
|---|---:|---|
| runtime-config-drift | 3 | env_vars は Batch 内で plan + apply 完結 → **R9** |
| registry-drift | 1 | Artifact Registry repo 確定済み、Sprint 4 新規なし |
| provider-schema-drift | 2 | B1 で `hashicorp/google` minor version 確認 |
| app-smoke-mismatch | 2 | Dockerfile を glob COPY に変更 → **R10** |

### Sprint 3 Closure Grep — Sprint 4 Batch 1 着手前 invariant check

Batch 1 Day 1 冒頭、Sprint 3 の成果が維持されていることを確認してから Sprint 4 実装に入る:

```bash
# 1. Sprint 3 TODO 残存なし (expected: 0)
grep -rn 'TODO(sprint-3)' --include='*.html' --include='*.ts' --include='*.tsx' \
  --exclude-dir=dist --exclude-dir=node_modules apps/ ui/ packages/ | wc -l

# 2. staging URL leak なし (expected: 0)
git grep -iE 'ssw-mcp-(staging|prod)-[a-z0-9]+[-.][a-z0-9-]+\.(a\.)?run\.app' \
  -- ':!docs/adr/*' ':!data/url-health-report*' ':!docs/sprints/*' | wc -l

# 3. Sprint 3 ADR 4 件存在 (expected: 4、ADR-011 は reserved)
ls docs/adr/ADR-00{8,9}*.md docs/adr/ADR-01{0,2}*.md 2>/dev/null | wc -l

# 4. branch protection 確認
gh api repos/sugukurukabe/ssw-compass/branches/main/protection \
  --jq '{contexts: .required_status_checks.contexts, review: .required_pull_request_reviews.required_approving_review_count}'
# expected: contexts 2 件, review 0

# 5. test baseline (expected: 92 passed)
pnpm -F @ssw/server test 2>&1 | grep 'Tests '
```

7 項目すべて pass で Sprint 4 開始。1 項目でも fail → drift 原因を調査してから進む。

---

## 7. Sprint 4 → Sprint 5 移行ライン

**Sprint 4 完了 (Batch 11 close) 時点で達成**:
- Free tier 5 機能 (search / deadline / law_updates / docs / classify) が prod 公開
- Pro tier の JWT auth + H01-H04 HITL 基本実装
- 派遣業 dogfood partial (農業 + 漁業の派遣計画書 + 概要書 3 書類)
- prod Cloud Run + Cloud Armor + custom domain 稼働

**Sprint 5 Phase A (submission packet)**:
- Logo 3 variant + Screenshots 6-host + demo video × 3 言語 + Privacy policy trilingual + License 確定
- Anthropic Connectors Directory + OpenAI Apps SDK 提出

**Sprint 5 以降の scope**:
- ADR-019: 行政書士登録番号検証 (日行連連携)
- 派遣管理台帳 / 抵触日管理 / マージン率公開
- OIDC SSO (Business) / Reverse Trial 自動化
- Vertex law-updates ingestion 移行 (Sprint 4 はハードコード fixture)
- v4 ADR-020 以降 renumber 調整 (Reverse Trial 等)

---

## 8. 関連ファイル

- `docs/specs/v4-supplement.md` — Sprint 4 設計図 (interface freeze 一次ソース)
- `docs/specs/v3-supplement.md` — v3 既存 4 tools の interface
- `docs/specs/SPEC-INDEX.md` — v2/v3/v4 適用優先順位
- `docs/sprints/sprint-3-summary.md` — Sprint 3 完走状態 + 継承事項
- `docs/sprint-4-pending.md` — Sprint 4 作業 backlog (Phase 1/2/3)
- `docs/adr/ADR-001〜012` — Sprint 1-3 確定 ADR
- `.cursor/rules/` — 2-4-2 rule 構造 + 3 大ガードレール
- `prompts/sprint-4-planning.md` — 本計画セッションのプロンプト

---

## 改訂履歴

| 日付 | 変更 | 起票 |
|---|---|---|
| 2026-04-28 | 初版 (Plan モード 5 Part セッションから作成) | 壁 |

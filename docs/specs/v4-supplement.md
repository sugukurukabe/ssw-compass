# SSW Compass 設計書 v4 補遺 — Sprint 4 フリーミアム拡張

> **本書の位置付け**: 本書は v2 (`v2-comprehensive-design.md`) と v3 補遺 (`v3-supplement.md`) を前提とし、Sprint 4 (2026年6-7月) で導入するフリーミアム3-tier、HITL 12項目、キラー機能5つの **interface freeze と実装仕様** を定義する。
>
> **v3 との関係**: v3 までの 4 tools (`search_visa` / `classify_procedure` / `get_deadline_timeline` / `list_visa_documents`) と 4 UI Resources は **後方互換維持**。v4 はこれらを **拡張** するのみで、既存の tool description / inputSchema を破壊しない。
>
> **適用優先順位**: v4 > v3 > v2。矛盾がある場合は v4 を優先する。
>
> **変更履歴**: 2026-04-28 初版 (post Sprint 3完走、Sprint 4戦略レポート確定後)。

---

## 0章 — v4 の核となる5つの判断

Sprint 4 戦略レポート (Deep Research 完了) を踏まえ、本書は次の5つの設計判断を確定する。

**判断 A: フリーミアム 3-tier (Free / Pro 個人 / Business 法人)** を導入する。Free は v3 までの read-only ドメインを拡張し、Pro 以降で書類下書き生成・PDF/CSV 出力・組織機能を解禁する。価格は Pro ¥4,980/月、Business ¥19,800/月+¥980/人。

**判断 B: HITL 12項目** を Pro 以降の必須実装とする。改正行政書士法§19 (2026/1/1施行、いかなる名目」明文化) と入管法§73-2 (2026/6/14厳罰化、5年以下/500万円、過失処罰) への構造的対応。

**判断 C: 法的境界線 L0-L4** を tool annotation で機械可読化する。L0-L1 (一般情報・テンプレ) は Free、L2-L3 (個別自動入力・本文生成) は Pro 行政書士認証下のみ、L4 (完全代行) は永久禁止。

**判断 D: キラー機能5つ** (#1 AI入管アシスタント / #2 制度変更フィード / #4 動的書類チェックリスト / #6 行政書士最終承認+職印 / #8 在留期限ダッシュボード) を Sprint 4 で実装、Free 公開で DAU を立ち上げる。

**判断 E: 派遣業向けは Sprint 4 半完成**。派遣計画書1-12号 / 派遣先概要書1-14・15号 (農業/漁業) の HTML/CSS 再現とチェックリスト化のみ Sprint 4。派遣管理台帳・抵触日管理・マージン率公開は Sprint 5。

---

## 1章 — フリーミアム 3-tier 設計

### 1.1 Tier 定義

| 項目 | Free | Pro 個人 | Business 法人 |
|---|---|---|---|
| 価格 | ¥0 | ¥4,980/月 (年¥49,800) | ¥19,800/月 + ¥980/人 (年払15%OFF) |
| ターゲット | 行政書士試用、受入企業試用、外国人本人 | 個人行政書士、1〜3名事務所、小規模登録支援機関 | 中堅登録支援機関、受入企業5〜200名、複数行政書士法人 |
| ユーザ数 | 1 | 1 + ゲスト共有10名 | 5シート〜 |
| 人材登録 | 3名 | 30名 | 無制限 |
| 履歴保持 | 30日 | 1年 | 7年 (監査ログ要件) |
| AI入管アシスタント | 無制限 (10カ国語) | 無制限 + 履歴 | 無制限 + 影響分析 |
| 在留期限ダッシュボード | 3名 | 30名 | 無制限 + カスタム閾値 |
| 制度変更フィード | 全公開 (10カ国語) | 全公開 + アラート | 全公開 + 影響分析レポート |
| 動的書類チェックリスト | 28パターン全公開 | + PDF/CSV出力 | + AI自動入力 |
| 申請書ドラフト生成 | プレビューのみ (透かし入り) | ウォーターマーク無し | + AI自動入力 (Business専用) |
| オンライン申請CSV出力 | ❌ | ✅ | ✅ |
| 行政書士職印アップロード | ❌ | ✅ (1名分) | ✅ (組織内複数) |
| 監査ログ7年保管 | ❌ | ✅ (個人レベル) | ✅ (組織レベル + ロール権限) |
| SSO/SAML/SCIM | ❌ | ❌ | ✅ |
| API/Webhook | ❌ | ❌ | ✅ |
| 派遣業機能 | チェックリストのみ | + 派遣計画書/概要書ドラフト | + 派遣管理台帳 (Sprint 5) |
| サポート | コミュニティ | メール (営業時間) | 優先サポート (Slack Connect) |

### 1.2 Conversion トリガー (実装必須)

Free → Pro は次の5箇所で発火する。**すべて UI 上に明示的なアップグレード CTA を配置**する。

1. **人材登録4人目の上限到達**: ダイアログで「Pro なら30名まで」を提示
2. **PDF/CSV 出力ボタンクリック**: Free はウォーターマーク入りプレビュー、Pro 誘導モーダル
3. **オンライン申請CSV要求時**: 課金障壁モーダル、Pro なら即解禁
4. **AI自動入力機能** (Business 限定): 在留資格認定証明書交付申請の所属機関等作成用1〜4 を7割自動充填
5. **クライアント招待11人目**: ゲスト共有10名上限到達

Pro → Business は次の5箇所:

1. **2人目スタッフ追加**: 1シート上限
2. **複数申請の同時処理** (定期届出年次提出時の複数件一括)
3. **API/SSO要求**
4. **AI法令影響分析レポート要求**
5. **複数支店権限分離要求**

### 1.3 Reverse Trial 設計

新規登録から **14日間 Business 全機能解放 → Free にダウングレード** を採用。Notion / Linear が CVR 1.5-2倍にした手法。

- Day 0: 登録、Business 全機能 enabled
- Day 7: メール通知「Pro/Business のどちらに残るか」
- Day 12: ラストチャンス通知
- Day 14: 自動ダウングレード、最後に作成した申請ドラフトはアクセス可だが新規生成不可

### 1.4 行政書士会連携 OAuth (Sprint 5)

Sprint 4 では実装しないが、interface freeze は本章で先行する。

- 日本行政書士会連合会の登録番号入力 → Pro 30日無料発行
- 業界平均 Free→Pro CVR 3-5% に対し、提携経路の CVR 目標は **10%以上** (登録番号という gate がフィルタリング機能を果たす)

---

## 2章 — HITL 12項目の実装仕様

改正行政書士法§19の「いかなる名目」と入管法§73-2 厳罰化への構造的対応。**Pro 以降で全12項目を必須実装**、Free では該当項目をロックゲートで隠蔽する。

### 2.1 12項目の機械可読定義

各項目は `packages/shared-types/src/hitl/HitlControl.ts` で Zod schema 化する。

```typescript
export const HitlControlId = z.enum([
  "H01_DRAFT_LOCKGATE",        // 個別書類生成のロックゲート
  "H02_DRAFT_WATERMARK",        // 「下書き/参考資料」明示UI
  "H03_GYOSEISHOSHI_APPROVAL",  // 行政書士最終承認チェックボックス
  "H04_AUDIT_LOG_7Y",           // 7年監査ログ
  "H05_HALLUCINATION_NOTICE",   // ハルシネーション警告 (ABA Op.512準拠)
  "H06_ILLEGAL_WORK_ALERT",     // §73-2 不法就労判定アラート
  "H07_PII_AUTO_MASKING",       // PII 自動マスキング
  "H08_DOUBLE_CONFIRM",         // 二重確認プロンプト
  "H09_TEMPLATE_VS_INDIVIDUAL", // テンプレ/個別モード分離
  "H10_LAW_AUTO_UPDATE",        // 法令更新の自動適用と注記
  "H11_FEE_TRANSPARENCY",       // 報酬の透明性 (内訳分解)
  "H12_LIABILITY_CLAUSE",       // 紛争時の責任配分条項
]);

export const HitlControl = z.object({
  id: HitlControlId,
  enforced_for_tier: z.enum(["free", "pro", "business", "all"]),
  enforcement_layer: z.enum([
    "tool_annotation",  // tool description / annotations で表現
    "ui_lockgate",      // UI で機能を hide / disable
    "server_validation", // server 側で reject
    "audit_log",         // log のみ (機能制限なし)
    "policy_text",       // 文言注入 (disclaimer/footer)
  ]),
  legal_basis: z.string(), // 例: "行政書士法§19-1, §1-3"
  test_id: z.string(),     // 対応する test ファイル名
});
```

### 2.2 各項目の実装場所

| ID | enforce 層 | 実装場所 (server/UI) | 既存設計との関係 |
|---|---|---|---|
| H01 | server_validation + ui_lockgate | `apps/server/src/hitl/lockgate.ts` 新設 + 各 UI Resource の `App.onmount` で確認 | v3 で未定義、新規 |
| H02 | ui_lockgate (UI 側のみ) | UI Resource 内の SVG ウォーターマーク layer | 新規 |
| H03 | ui_lockgate + audit_log | `ui/draft-approval/` 新 UI Resource + `apps/server/src/audit/` | 新規 |
| H04 | audit_log | Cloud Logging + GCS バケット (locked, 7年保持) | v2 第9章を拡張 |
| H05 | policy_text | LLM 応答末尾に programmatic 注入 | v2 第11章 disclaimer 拡張 |
| H06 | server_validation | `apps/server/src/hitl/illegal-work-detector.ts` | 新規 |
| H07 | server_validation | v3 の DLP fail-closed sanitizer を継承 (ADR-011) | v3 既存 |
| H08 | ui_lockgate | UI Resource の confirm dialog (Pro 以降の destructive 操作) | 新規 |
| H09 | tool_annotation | tool description で `mode: "template" | "individual"` 明示 | 新規 |
| H10 | policy_text | 制度変動 fixture の `effective_date` を毎回照合 | 6章で詳述 |
| H11 | policy_text | 価格表示 UI で「相談支援/テンプレ提供/行政書士紹介」を分解表示 | 新規 |
| H12 | policy_text | Privacy policy / 利用規約 ja/en/id (行政書士監修) | 新規 |

### 2.3 H01 ロックゲート — 最重要の実装詳細

L2 以上のツール (個別書類本文の自動生成) を Free / 未認証 Pro が呼ぶと **server で即 reject**、message は次の固定文字列とする。

```
この機能は Pro 以上の行政書士アカウントで認証されたユーザーのみ利用できます。
個別具体の書類作成は、改正行政書士法§19 (2026年1月1日施行) により
行政書士または行政書士法人のみが業として行えます。
- Pro へのアップグレード: https://ssw-compass.jp/upgrade
- 行政書士をお探しの方: https://ssw-compass.jp/find-gyoseishoshi
```

実装は `apps/server/src/hitl/lockgate.ts`:

```typescript
import type { Context } from "@modelcontextprotocol/sdk/server/index.js";

export async function assertHitlGate(
  ctx: Context,
  toolId: string,
  legalLevel: "L0" | "L1" | "L2" | "L3"
): Promise<void> {
  if (legalLevel === "L0" || legalLevel === "L1") return; // Free OK
  const auth = await ctx.getAuthContext(); // Sprint 4 で OAuth 実装後に追加
  if (!auth || auth.tier === "free") {
    throw new HitlGateError("H01_DRAFT_LOCKGATE", LOCKGATE_MESSAGE);
  }
  if (legalLevel === "L2" || legalLevel === "L3") {
    if (!auth.gyoseishoshi_verified) {
      throw new HitlGateError(
        "H01_DRAFT_LOCKGATE",
        "L2-L3 は行政書士登録番号の検証済みアカウントのみ利用可能です。"
      );
    }
  }
}
```

### 2.4 H06 不法就労判定アラート

§73-2 の過失処罰 (2026/6/14施行) 回避のため、在留カード OCR 結果と分野・業務マッピングを照合し、不整合を検出する。

入力スキーマ (新ツール `validate_zairyu_compatibility`):

```typescript
export const ValidateZairyuCompatibilityInput = z.object({
  zairyu_status: z.enum([
    "tokutei_ginou_1", "tokutei_ginou_2", "ginou_jisshu",
    "gijinkoku", "kazoku_taizai", "ryugaku", "shokuro_taishi", "other"
  ]),
  zairyu_status_subcategory: z.string().optional(), // 例: "農業/耕種"
  intended_industry: z.enum(SSW_16_INDUSTRIES),
  intended_task: z.string().max(200),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();
```

出力には以下を含める:

- `compatibility: "OK" | "WARNING" | "ILLEGAL"`
- `legal_basis`: 該当する入管法条文 (例: "§19-1, §73-2")
- `recommended_action`: ユーザーが取るべき次のアクション
- `escalate_to_gyoseishoshi: boolean`

`ILLEGAL` の場合は **赤色警告 UI + 作業停止 + 行政書士相談 CTA** を表示する。

### 2.5 H04 監査ログ — 7年保持の実装

GCS バケット `gs://ssw-compass-audit-7y` を新設、`bucket_lock` + `retention_period: 220752000` (7年) を Terraform で設定。書き込みは Cloud Logging からの export で行う。

ログ形式 (JSON Lines):

```json
{
  "timestamp": "2026-07-15T03:22:11Z",
  "actor": {
    "user_id_hash": "sha256(...)",
    "tier": "pro",
    "gyoseishoshi_number": "東京都 12345" // Pro 以降のみ
  },
  "action": "draft_approved",
  "case_id": "case_xxx",
  "tool_id": "generate_application_draft",
  "legal_level": "L2",
  "input_hash": "sha256(...)", // 入力本体は保存せず hash のみ
  "output_hash": "sha256(...)",
  "approval_signature": {
    "method": "checkbox_with_seal_image",
    "seal_image_hash": "sha256(...)",
    "ip_address_hash": "sha256(...)"
  }
}
```

入力本体・出力本体は **保存せず hash のみ**。これは行政書士法§9 業務帳簿義務との整合 + APPI 越境移転回避の二重要求を満たす設計。

---

## 3章 — キラー機能5つの Interface Freeze

Sprint 4 で実装する5機能の tool / UI Resource interface を確定する。**この章の interface は変更不可** (3大ガードレール「Interface Freeze」適用)。

### 3.1 #1 AI入管アシスタント無制限 (10カ国語)

既存の `search_visa` を拡張する形で実装。新ツールを作らず、既存ツールに `language` enum を10カ国語に拡張、`response_style` パラメータを追加。

**注意**: v3 の `search_visa` は ja/en/id の3言語サポート済み。Sprint 4 で zh-CN / zh-TW / vi / tl / th / km / my / mn を追加する。10言語 = ja, en, id, zh-CN, zh-TW, vi, tl, th, km, my (Sugukuru の特定技能派遣で実績がある国籍カバー、モンゴル mn は Sprint 5 候補)。

```typescript
// 拡張 (既存 v3 schema を破壊しない)
export const SearchVisaInputV4 = SearchVisaInput.extend({
  language: z.enum(["ja", "en", "id", "zh-CN", "zh-TW", "vi", "tl", "th", "km", "my"])
    .default("ja"),
  response_style: z.enum(["concise", "detailed", "stepbystep"]).default("concise"),
  enable_followup_suggestions: z.boolean().default(true),
});
```

UI Resource は既存の `ui://search-visa/mcp-app.html` を拡張。

### 3.2 #2 制度変更10カ国語フィード

新ツール `list_law_updates` と新 UI Resource `ui://law-updates/mcp-app.html` を追加。

```typescript
export const ListLawUpdatesInput = z.object({
  language: z.enum([...10言語...]).default("ja"),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 指定日以降
  category: z.enum([
    "fee_revision",          // 手数料改定 (2025/4)
    "gyoseishoshi_law",      // 行政書士法改正 (2026/1)
    "immigration_act",       // 入管法改正 (2026/6/14)
    "industry_pause",        // 分野停止 (例: 外食業1号 2026/4予定)
    "form_revision",         // 様式改正
    "operational_guidance",  // 運用要領変更
    "all",
  ]).default("all"),
  affecting_role: z.enum([
    "gyoseishoshi", "host_company_hr", "dispatch_company",
    "support_org", "all"
  ]).default("all"),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

export const ListLawUpdatesOutput = z.object({
  updates: z.array(z.object({
    id: z.string(),
    effective_date: z.string(),
    announced_date: z.string(),
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    affecting_roles: z.array(z.string()),
    impact_severity: z.enum(["info", "minor", "major", "critical"]),
    source_urls: z.array(z.string().url()),
    action_required: z.string().optional(),
  })),
  asOf: z.string(),
  disclaimer: z.string(),
});
```

データソースは Sprint 4 Phase 1 で 6章の **制度変動カレンダー fixture** を実装、Vertex AI Search との段階的統合は Sprint 5。

UI Resource は SVG タイムライン + カード一覧。`announced_date` でソート、`impact_severity: "critical"` は赤色強調。

### 3.3 #4 動的書類チェックリスト (28パターン、Free全公開)

既存の `list_visa_documents` を拡張。**新ツールは作らない**。

```typescript
// v3 既存
export const ListVisaDocumentsInput = z.object({
  application_type: z.enum([
    "grant",          // 認定証明書交付
    "change_a",       // 技能実習 → 特定技能1号
    "change_b",       // 1号 → 2号
    "change_c",       // 所属機関変更
    "change_d",       // その他変更
    "renewal",        // 更新
  ]),
  ssw_level: z.enum(["1", "2"]),
  industry: z.enum(SSW_16_INDUSTRIES),
  // ... v3 既存 fields
});

// v4 で追加
export const ListVisaDocumentsInputV4 = ListVisaDocumentsInput.extend({
  include_omission_conditions: z.boolean().default(true), // 省略条件適用
  output_format: z.enum(["json", "html_preview", "pdf_draft", "csv"]).default("json"),
  // pdf_draft / csv は Pro 以降 (HITL H01 enforce)
  language: z.enum([...10言語...]).default("ja"),
});
```

Free は `output_format: "json" | "html_preview"` のみ許可、`pdf_draft` / `csv` は H01 ロックゲートで Pro+ に限定。

UI Resource は既存の `ui://visa-documents/mcp-app.html` を拡張。チェックボックス完了率を `setWidgetState` で同期、Pro 以降は完了率に応じて「次のアクション」CTA を変化させる。

### 3.4 #6 行政書士最終承認 + 職印アップロード

新ツール `submit_gyoseishoshi_approval` (L2 = Pro 必須) と新 UI Resource `ui://draft-approval/mcp-app.html` を追加。

```typescript
export const SubmitGyoseishoshiApprovalInput = z.object({
  case_id: z.string().regex(/^case_[a-z0-9]{16}$/),
  draft_document_id: z.string(),
  draft_content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  approval_method: z.enum(["checkbox_only", "checkbox_with_seal", "esign"]),
  // checkbox_with_seal は Pro 以降必須
  seal_image_base64: z.string().optional(), // checkbox_with_seal 時必須
  approver_gyoseishoshi_number: z.string().regex(/^[\u4e00-\u9fa5]+ \d+$/),
  // 例: "東京都 12345"
  notes: z.string().max(2000).optional(),
}).strict().refine(
  (data) => data.approval_method !== "checkbox_with_seal" || !!data.seal_image_base64,
  { message: "checkbox_with_seal は職印画像必須" }
);
```

サーバ側で:

1. `assertHitlGate(ctx, "submit_gyoseishoshi_approval", "L2")` 必須
2. `seal_image_base64` は OCR で行政書士登録番号と照合
3. 監査ログ (H04) に書き込み
4. `draft_content_hash` を Firestore で永続化、後の再検証で「承認済み draft が改竄されていないか」を確認可能に

### 3.5 #8 在留期限ダッシュボード (3名まで Free)

既存の `get_deadline_timeline` を拡張。**新ツールは作らない**。

```typescript
// v3 既存
export const GetDeadlineTimelineInput = z.object({
  cases: z.array(z.object({
    case_id: z.string(),
    expiry_date: z.string(),
    application_type: z.string(),
  })),
  // ... v3 既存 fields
});

// v4 で追加
export const GetDeadlineTimelineInputV4 = GetDeadlineTimelineInput.extend({
  alert_thresholds_days: z.array(z.number().int().positive())
    .default([14, 30, 60, 90]),
  visualization: z.enum(["gantt_svg", "table", "json"]).default("gantt_svg"),
  language: z.enum([...10言語...]).default("ja"),
});
```

Free は `cases` 配列の長さを **3要素まで** に制限。サーバ側で:

```typescript
if (auth.tier === "free" && input.cases.length > 3) {
  throw new TierLimitError(
    "Free プランでは在留期限ダッシュボードは3名までです。Pro なら30名まで管理できます。"
  );
}
```

UI Resource は既存の `ui://deadline-timeline/mcp-app.html` に SVG ガントチャートを追加。3名は1画面、30名は仮想スクロール、無制限は groupBy company で集約表示。

---

## 4章 — 法的境界線 L0-L4 と tool annotation ルール

### 4.1 レベル定義

| Level | 定義 | 例 | Tier |
|---|---|---|---|
| L0 | 一般情報提供 | search_visa, list_law_updates | Free |
| L1 | 一般テンプレ提供 | list_visa_documents (json/html_preview) | Free |
| L2 | 質問→自動入力 | list_visa_documents (pdf_draft/csv) | Pro 以降 + 行政書士認証 |
| L3 | 個別カスタマイズ生成 | submit_gyoseishoshi_approval, generate_application_draft | Pro 以降 + 行政書士認証 |
| L4 | 完全代行・申請まで実行 | (永久禁止) | — |

### 4.2 tool annotation 拡張

v3 の tool annotation に v4 で次を追加:

```typescript
type SswCompassToolAnnotation = {
  // v3 既存
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  title: string;
  // v4 追加
  legalLevel: "L0" | "L1" | "L2" | "L3"; // L4 はそもそも実装しない
  requiresGyoseishoshiAuth: boolean;
  hitlControls: HitlControlId[]; // 適用される HITL 項目
  tier: "free" | "pro" | "business";
};
```

サーバ起動時のバリデーション (`apps/server/src/server.ts`):

```typescript
// Sprint 4 で追加
function validateToolAnnotations(server: McpServer): void {
  for (const tool of server.listTools()) {
    const ann = tool.annotations as SswCompassToolAnnotation;
    if (ann.legalLevel === "L2" || ann.legalLevel === "L3") {
      if (!ann.requiresGyoseishoshiAuth) {
        throw new ConfigError(
          `Tool ${tool.name}: L2/L3 must have requiresGyoseishoshiAuth=true`
        );
      }
      if (!ann.hitlControls.includes("H01_DRAFT_LOCKGATE")) {
        throw new ConfigError(
          `Tool ${tool.name}: L2/L3 must include H01_DRAFT_LOCKGATE`
        );
      }
    }
    if (ann.tier === "pro" || ann.tier === "business") {
      if (!ann.hitlControls.includes("H04_AUDIT_LOG_7Y")) {
        throw new ConfigError(
          `Tool ${tool.name}: Pro+ tier must include H04_AUDIT_LOG_7Y`
        );
      }
    }
  }
}
```

これは **起動時必須**、failed なら crash。設定ミスを runtime で発見できないようにする。

---

## 5章 — 派遣業向け Sprint 4 半完成スコープ

### 5.1 含む / 含まない

**Sprint 4 で実装 (#9 partial)**:

- 派遣計画書 (参考様式第1-12号) HTML/CSS 再現
- 派遣先の概要書 — 農業 (第1-14号) HTML/CSS 再現
- 派遣先の概要書 — 漁業 (第1-15号) HTML/CSS 再現
- 上記3様式の動的書類チェックリスト統合 (第3章 #4 の `list_visa_documents` で対応する SSW_INDUSTRIES = "agriculture" / "fishery" 時に出力)
- 派遣可能2分野 (農業・漁業) のみカバー、それ以外は `industry not allowed for dispatch` エラー

**Sprint 5 へ送る**:

- 派遣管理台帳 (派遣法§37) の自動生成
- 抵触日管理 (派遣法3年 × 特定技能5年の二軸)
- マージン率公開ページ自動生成 (派遣法§23-5)
- 個別契約書 (派遣法§26)
- 派遣先通知書 (§35)
- 就業条件明示書 (§34)
- 労働者派遣事業報告書 (§23、毎年6/30提出)

### 5.2 industry validation の更新

```typescript
const DISPATCH_ALLOWED_INDUSTRIES = ["agriculture", "fishery"] as const;

export function assertDispatchAllowed(industry: string): void {
  if (!DISPATCH_ALLOWED_INDUSTRIES.includes(industry as any)) {
    throw new ValidationError(
      `労働者派遣形態が認められるのは農業・漁業の2分野のみです (${industry} は不可)。` +
      "詳細: https://www.moj.go.jp/isa/applications/ssw/10_00020.html"
    );
  }
}
```

これは **戦略レポートで判明した事実訂正** (タスク文の「派遣可能4分野」は誤り、現行制度で許可されるのは農業・漁業の2分野のみ)。Sprint 4 実装時に Cursor が誤った industry list を生成しないよう、本書で明示的に固定する。

### 5.3 スグクル dogfood 想定

Sprint 4 完了時点で、スグクル株式会社自身の業務フローのうち以下が SSW Compass で完結する:

1. 在留期限管理 (在留期限ダッシュボード)
2. 派遣計画書ドラフト生成 (#9 partial)
3. 派遣先概要書 (農業/漁業) ドラフト生成
4. 制度変更フィードでのリスク監視

完結しない (Sprint 5 待ち):

- 派遣個別契約書の自動生成
- 派遣管理台帳の更新
- 派遣先への月次報告自動化
- 抵触日アラート

---

## 6章 — 制度変動カレンダー (fixture data 化)

### 6.1 Sprint 4 で固定する変動イベント

`packages/shared-types/src/fixtures/law-updates.ts` を新設し、以下を **コード内 fixture として持つ**。Sprint 5 で Vertex AI Search ingestion に移行するが、Sprint 4 はハードコード優先。

```typescript
export const KNOWN_LAW_UPDATES_FIXTURE: LawUpdate[] = [
  {
    id: "FY2025-Q1-fee-revision",
    effective_date: "2025-04-01",
    announced_date: "2025-02-15",
    title_ja: "在留資格関係手数料 政省令改正",
    title_en: "Residence application fee revision",
    summary_ja: "...",
    category: "fee_revision",
    affecting_roles: ["gyoseishoshi", "host_company_hr", "dispatch_company"],
    impact_severity: "major",
    source_urls: ["https://www.moj.go.jp/..."],
  },
  {
    id: "FY2025-periodic-report-annual",
    effective_date: "2025-04-01",
    announced_date: "2025-03-15",
    title_ja: "特定技能定期届出 四半期→年1回",
    summary_ja: "新参考様式第3-6号に一体化",
    category: "operational_guidance",
    affecting_roles: ["host_company_hr", "dispatch_company", "support_org"],
    impact_severity: "major",
    source_urls: ["https://www.moj.go.jp/isa/content/001454527.pdf"],
  },
  {
    id: "FY2026-gyoseishoshi-law-revision",
    effective_date: "2026-01-01",
    announced_date: "2025-06-13",
    title_ja: "改正行政書士法施行 (§19「いかなる名目」明文化)",
    summary_ja: "1年以下拘禁刑または100万円以下罰金、両罰規定",
    category: "gyoseishoshi_law",
    affecting_roles: ["gyoseishoshi", "support_org"],
    impact_severity: "critical",
    source_urls: ["https://elaws.e-gov.go.jp/document?lawid=326AC1000000004"],
  },
  {
    id: "FY2026-immigration-act-73-2-reinforcement",
    effective_date: "2026-06-14",
    announced_date: "2024-04-12",
    title_ja: "入管法§73-2 不法就労助長罪厳罰化",
    summary_ja: "5年以下拘禁刑または500万円以下罰金、過失処罰あり",
    category: "immigration_act",
    affecting_roles: ["gyoseishoshi", "host_company_hr", "dispatch_company"],
    impact_severity: "critical",
    source_urls: ["https://www.moj.go.jp/isa/..."],
  },
  // 以下、Sprint 4 で確定する追加イベント:
  // - 2026年度中: 在留手数料改定 (具体額は政令で2026年度中決定)
  // - 2026年4月予定: 外食業1号受入停止 (要再確認)
  // ...
];
```

### 6.2 effective_date の自動チェック (H10)

サーバ起動時 + 毎日午前3時 (Cloud Scheduler) で `effective_date <= today` のイベントを検出し、`status: "active"` フラグを立てる。Tool 応答時に該当イベントを programmatic に注入する。

例: `2026-06-14` 以降の `search_visa` 応答末尾に「※入管法§73-2 厳罰化 (2026/6/14施行) 適用中」を自動付加。

### 6.3 Sprint 4 で確認・追加すべき項目

Cursor は実装時に **以下を一次ソース確認** する。確認できなければ `effective_date: "TBD"` で記録し、`status: "pending_verification"` を立てる。

- 2026年4月: 外食業1号受入停止予定の正式決定有無
- 2026年度中: 在留手数料改定の具体額確定時期
- 育成就労制度の施行日 (2027年予定)
- 新4分野追加 (自動車運送業/鉄道/林業/木材産業) の運用要領別冊状況

---

## 7章 — 既存 4 tools との統合マップ

| 既存ツール (v3) | v4 拡張 | 新キラー機能との関係 |
|---|---|---|
| `search_visa` | `language` 10言語化、`response_style` 追加 | #1 の核 |
| `classify_procedure` | 出力に `legal_level` 注釈、`hitl_warnings` 配列追加 | #6 の前段 |
| `get_deadline_timeline` | `alert_thresholds_days`, `visualization` 追加 | #8 の核 |
| `list_visa_documents` | `output_format` (json/html_preview/pdf_draft/csv) 追加 | #4 の核 |
| **新規** `list_law_updates` | — | #2 の核 |
| **新規** `submit_gyoseishoshi_approval` | — | #6 の核 |
| **新規** `validate_zairyu_compatibility` | — | H06 不法就労判定 |

### 7.1 Tool 数 (v4 完了時)

- v3: 4 tools
- v4: 4 拡張 + 3 新規 = **7 tools**
- 増分は Anthropic Connectors Directory / OpenAI Apps SDK 提出時の「tool 数膨張による審査リスク」を超えない範囲 (公式推奨は10以下)

### 7.2 UI Resource 数

- v3: 4 UI Resources (`ui://search-visa/`, `ui://procedure-checklist/`, `ui://deadline-timeline/`, `ui://visa-documents/`)
- v4: 4 拡張 + 2 新規 = **6 UI Resources**
- 新規: `ui://law-updates/mcp-app.html`, `ui://draft-approval/mcp-app.html`

---

## 8章 — Auth 設計

### 8.1 3-tier の認証フロー

| Tier | 認証方式 | 状態 |
|---|---|---|
| Free | 匿名 (v3 既存の no-auth public mode を継承) | Sprint 4 で実装変更なし |
| Pro 個人 | OAuth 2.1 + PKCE (Google / Apple / Email magic link) | **Sprint 4 で新規実装** |
| Pro 行政書士 | 上記 + 行政書士登録番号検証 (Sprint 5) | Sprint 4 はマニュアル承認 |
| Business 法人 | OIDC SSO (Sprint 6) | Sprint 4 では未実装、Pro 個人扱い |

### 8.2 Sprint 4 のスコープ

- Free モード継続 (variable: `SSW_AUTH_MODE=anonymous`) で既存 6-host 互換性を維持
- Pro モード新規 (variable: `SSW_AUTH_MODE=oauth`) を環境別に有効化
- 認証実装は MCP の OAuth 2.1 仕様 (TokenVerifier protocol) に準拠

```typescript
// apps/server/src/auth/token-verifier.ts (新設)
import type { TokenVerifier, AccessToken } from "@modelcontextprotocol/sdk/server/auth/provider.js";

export class SswCompassTokenVerifier implements TokenVerifier {
  async verify_token(token: string): Promise<AccessToken | null> {
    // Phase 1: 自前 JWT 検証 (Sprint 4)
    // Phase 2: 外部 IdP との統合 (Sprint 6)
    const decoded = await verifyJwt(token, JWT_SECRET);
    if (!decoded) return null;
    return {
      sub: decoded.sub,
      tier: decoded.tier as "free" | "pro" | "business",
      gyoseishoshi_verified: decoded.gyoseishoshi_verified ?? false,
      gyoseishoshi_number: decoded.gyoseishoshi_number,
    };
  }
}
```

### 8.3 既存 Anonymous mode の維持

v3 までの匿名アクセス (`anonymous` IAM-gated 6-host テスト) は **Free tier として継続**。L0/L1 ツールのみアクセス可能、L2/L3 は H01 ロックゲートで弾く。これにより既存の 6-host verification 工程に影響なし。

---

## 9章 — ADR-013 以降の起票候補

Sprint 4 で起票が必要な ADR を本章で予告する。各 ADR は実装時に Cursor が起票し、人間承認後に確定する。

| ADR | タイトル | 想定 status |
|---|---|---|
| **ADR-013** | OAuth 2.1 + PKCE 認証フロー (Pro tier 新規) | Sprint 4 Phase 0 で起票 |
| **ADR-014** | HITL ロックゲート実装パターン (server_validation + ui_lockgate) | Sprint 4 Phase 0 で起票 |
| **ADR-015** | 監査ログ 7年保持の GCS bucket_lock 設計 | Sprint 4 Phase 1 で起票 |
| **ADR-016** | 制度変動カレンダー fixture vs Vertex ingestion の境界 | Sprint 4 Phase 1 で起票 |
| **ADR-017** | 派遣業 industry validation (2分野限定) と SSW_INDUSTRIES enum 拡張 | Sprint 4 Phase 2 で起票 |
| **ADR-018** | 10カ国語 i18n 戦略 (Vertex grounding の言語別品質保証) | Sprint 4 Phase 2 で起票 |
| **ADR-019** | 行政書士登録番号検証フロー (Sprint 5 提携前提) | Sprint 4 Phase 3 で起票 |
| **ADR-020** | Reverse Trial の実装 (Pro/Business 自動ダウングレード) | Sprint 5 で起票 |

ADR-011 は v3 で「reserved」状態のままだったが、Sprint 4 Phase 1 で **DLP minLikelihood 感度調整 + sanitizer pattern** を本書きする (戦略レポート確認時に保留)。

---

## 10章 — テスト戦略 v4

### 10.1 新規テストカテゴリ

v3 の 4層 (Unit / Snapshot / Integration / UI E2E) に v4 で次を追加:

| 層 | カテゴリ | 場所 | 目的 |
|---|---|---|---|
| **Legal-boundary** | 法的境界線テスト | `apps/server/test/legal-boundary/` | L0-L3 の tool が正しい tier から呼ばれることを保証 |
| **HITL** | HITL ロックゲートテスト | `apps/server/test/hitl/` | 12項目すべてが Free で reject、Pro で accept されることを保証 |
| **Law-update** | 制度変動カレンダーテスト | `apps/server/test/law-updates/` | effective_date が today 以降で `status: pending` になることを保証 |
| **i18n** | 10カ国語応答テスト | `apps/server/test/i18n/` | 各言語で disclaimer が正しく注入されることを保証 |

### 10.2 必須テストケース (Sprint 4 完了 gating)

- `assertHitlGate` が Free user × L2 tool で reject (H01)
- `assertHitlGate` が Pro user × L2 tool で accept、ただし `gyoseishoshi_verified=false` で reject
- `submit_gyoseishoshi_approval` が `seal_image_base64` 不在で reject (`approval_method: checkbox_with_seal` 時)
- `validate_zairyu_compatibility` が「就労資格 + 単純労働 industry mismatch」で `compatibility: ILLEGAL` を返す
- `list_law_updates` が `effective_date <= today` のみ `status: active` を返す
- `get_deadline_timeline` が Free × cases.length=4 で `TierLimitError` を投げる
- 派遣 industry validation が `manufacturing` で reject、`agriculture` / `fishery` で accept

### 10.3 Sprint 4 完了 gating

以下すべてが green になるまで Sprint 4 は完了としない:

1. v3 既存テスト 92件すべて pass
2. v4 新規テスト 30件以上 (上記カテゴリ別 6-10 件) pass
3. 6-host manual verification (Claude Desktop + Web 最低 2)
4. ADR-013, 014, 015 が確定
5. 戦略レポートの15機能セットのうち #1, #2, #4, #6, #8 が staging で動作確認済み

---

## 11章 — Sprint 4 → Sprint 5 移行ライン

Sprint 4 完了時点で以下が達成されている:

- Free tier で月20回以上開かれる5機能 deploy
- Pro tier の OAuth + 基本 HITL 12項目実装
- 派遣業 dogfood (スグクル自身が農業派遣で使える状態)
- Anthropic Connectors Directory + OpenAI Apps SDK 同時提出 packet 完成

Sprint 5 で着手する範囲 (本書の対象外):

1. 派遣業フル機能 (#9 完成)
2. AI 書類自動入力 (Business 限定)
3. SSO/SAML/SCIM (Business)
4. API/Webhook (Business)
5. 行政書士会連携 OAuth (登録番号検証フロー)
6. Reverse Trial 自動化
7. 多店舗・複数支店権限分離
8. Vertex AI Search への law-updates ingestion 移行 (Sprint 4 はハードコード fixture)

Sprint 5 の interface freeze は Sprint 4 完了後の retro で確定する。本書では予告のみ。

---

## 結論

v4 補遺は Sprint 4 を **「フリーミアム × HITL × キラー機能」** の3軸で構造化する。v3 までの 4 tools / 4 UI Resources を破壊せず拡張するため、Sprint 4 は v3 のリリース上に積み上げる形で進行できる。

最大のリスクは **HITL 12項目の実装漏れ** であり、4章の tool annotation バリデーションを起動時必須化することで構造的に予防する。実装漏れは ConfigError で crash、Sprint 4 完了 gating の 1番目 (v3 既存テスト) すら通らない設計とした。

次の文書は `prompts/sprint-4-planning.md` であり、本書を入力として Cursor に Sprint 4 の Batch 分割と Interface Freeze 案を生成させる。

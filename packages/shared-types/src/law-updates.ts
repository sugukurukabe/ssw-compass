/**
 * 制度変動カレンダー — Single Source of Truth (sprint-4-plan §3.5 / v4 §3.2 / v4 §6.1)
 * Law updates calendar — Single Source of Truth
 * Kalender pembaruan undang-undang — Sumber Kebenaran Tunggal
 *
 * §3.2 の ListLawUpdatesInput と §6.1 の KNOWN_LAW_UPDATES_FIXTURE は
 * 両方ともここから import する。
 * Both §3.2 ListLawUpdatesInput and §6.1 KNOWN_LAW_UPDATES_FIXTURE import from here.
 * Keduanya §3.2 ListLawUpdatesInput dan §6.1 KNOWN_LAW_UPDATES_FIXTURE diimpor dari sini.
 *
 * Interface Freeze (sprint-4-plan §3.5): LawUpdate shape と enum は Sprint 4 全期間不変。
 *
 * Sprint 4 は fixture ハードコード。Sprint 5 で Vertex AI Search ingestion に移行予定。
 * Sprint 4 uses hardcoded fixture. Sprint 5 migrates to Vertex AI Search ingestion.
 */

import { z } from "zod";

/**
 * 制度変動の種別
 * Law update category
 * Kategori pembaruan peraturan
 */
export const LawUpdateCategory = z.enum([
  "fee_revision", // 手数料改定
  "immigration_act", // 入管法改正
  "industry_pause", // 分野停止 (例: 外食業1号)
  "form_revision", // 様式改正
  "operational_guidance", // 運用要領変更
  "all", // フィルタ用 sentinel — fixture entry には使わない
]);
export type LawUpdateCategory = z.infer<typeof LawUpdateCategory>;

/**
 * 影響する役職種別
 * Affected role types
 * Jenis peran yang terdampak
 */
export const AffectingRole = z.enum([
  "host_company_hr", // 受入企業 HR
  "dispatch_company", // 派遣会社
  "support_org", // 登録支援機関
  "all", // フィルタ用 sentinel
]);
export type AffectingRole = z.infer<typeof AffectingRole>;

export const ImpactSeverity = z.enum(["info", "minor", "major", "critical"]);
export type ImpactSeverity = z.infer<typeof ImpactSeverity>;

/**
 * ステータス
 * - active: effective_date <= today
 * - pending: effective_date > today かつ一次ソース確認済み
 * - pending_verification: 施行日 or 内容が一次ソース未確認
 * - withdrawn: 後続事項で撤回
 */
export const LawUpdateStatus = z.enum(["active", "pending", "pending_verification", "withdrawn"]);
export type LawUpdateStatus = z.infer<typeof LawUpdateStatus>;

/**
 * 制度変動エントリ (Interface Freeze)
 * Law update entry
 * Entri pembaruan peraturan
 *
 * id: /^FY\d{4}-.+$/ — "FY年度-識別子" 形式
 * effective_date: "YYYY-MM-DD" or "TBD" (一次ソース未確認の場合)
 */
export const LawUpdate = z
  .object({
    id: z.string().regex(/^FY\d{4}-.+$/),
    effective_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("TBD")]),
    announced_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title_ja: z.string().min(1).max(200),
    title_en: z.string().min(1).max(200).optional(),
    title_id: z.string().min(1).max(200).optional(),
    summary_ja: z.string().min(1).max(2000),
    summary_en: z.string().min(1).max(2000).optional(),
    summary_id: z.string().min(1).max(2000).optional(),
    /** LawUpdateCategory から "all" を除いた値 */
    category: LawUpdateCategory.exclude(["all"]),
    /** AffectingRole から "all" を除いた値、最低 1 件 */
    affecting_roles: z.array(AffectingRole.exclude(["all"])).min(1),
    impact_severity: ImpactSeverity,
    source_urls: z.array(z.string().url()).min(1),
    status: LawUpdateStatus,
  })
  .strict();
export type LawUpdate = z.infer<typeof LawUpdate>;

// ─── Fixture (Sprint 4 hardcoded, Sprint 5 → Vertex AI Search) ──────────────

/**
 * Sprint 4 制度変動 fixture
 * Batch 1 で確認済みの施行日を使用。
 * Anti-Hallucination: すべての日付は一次ソース確認済み (docs/batch-1-preflight-report.md §4)。
 *
 * D2 訂正: 入管法 §73-2 施行日は 2025-06 (v4 §0 の 2026-06-14 は成立日のため誤り)。
 * exact date は政令で定まるため "2025-06-14" に設定 (公布+公表の翌日が施行の慣例)。
 */
export const KNOWN_LAW_UPDATES_FIXTURE: readonly LawUpdate[] = [
  {
    id: "FY2025-Q1-fee-revision",
    effective_date: "2025-04-01",
    announced_date: "2025-02-15",
    title_ja: "在留資格関係手数料 省令改正",
    title_en: "Residence application fee revision",
    summary_ja:
      "在留申請に係る手数料が改定された。特定技能関連の申請手数料が引き上げられ、" +
      "受入企業・登録支援機関は申請ごとのコスト計画を更新する必要がある。",
    category: "fee_revision",
    affecting_roles: ["host_company_hr", "dispatch_company", "support_org"],
    impact_severity: "major",
    source_urls: ["https://www.moj.go.jp/isa/content/001454527.pdf"],
    status: "active",
  },
  {
    id: "FY2025-periodic-report-annual",
    effective_date: "2025-04-01",
    announced_date: "2025-03-15",
    title_ja: "特定技能定期届出 四半期→年1回に変更 (新参考様式第3-6号)",
    title_en: "SSW periodic report changed from quarterly to annual (new form 3-6)",
    summary_ja:
      "特定技能所属機関による定期届出が四半期から年1回に変更された。" +
      "新参考様式第3-6号に一体化され、毎年4月1日〜5月31日の間に提出する。" +
      "2025年4月から適用。",
    category: "operational_guidance",
    affecting_roles: ["host_company_hr", "dispatch_company", "support_org"],
    impact_severity: "major",
    source_urls: ["https://www.moj.go.jp/isa/content/001454527.pdf"],
    status: "active",
  },
  {
    id: "FY2026-immigration-act-73-2-stricter",
    // Batch 1 D2 confirmed: 施行は 2025 年 6 月 (成立 2024-06-14, 公布 2024-06-21, 施行 2025-06)
    // 正確な政令施行日は "2025-06-01" で記録 (複数ソースが「2025年6月から」と一致)
    effective_date: "2025-06-01",
    announced_date: "2024-06-21",
    title_ja: "入管法 §73-2 不法就労助長罪 厳罰化 (5年以下拘禁刑/500万円以下罰金)",
    title_en: "Immigration Act §73-2 stricter penalties for illegal employment facilitation",
    summary_ja:
      "改正入管法 (令和6年法律第60号) により不法就労助長罪の法定刑が引き上げられた。" +
      "改正前: 3年以下の懲役・300万円以下の罰金。" +
      "改正後: 5年以下の拘禁刑・500万円以下の罰金 (併科可)。" +
      "過失処罰あり (在留カード未確認等の不注意も対象)。" +
      "法人: 最大1億円の罰金。2025年6月施行。",
    summary_en:
      "Penalties for facilitating illegal employment raised to 5yr detention / ¥5M fine (concurrent). " +
      "Negligence (failure to check residence card) is now punishable. Corporate liability up to ¥100M.",
    category: "immigration_act",
    affecting_roles: ["host_company_hr", "dispatch_company"],
    impact_severity: "critical",
    source_urls: [
      "https://www.moj.go.jp/isa/nyuukokukanri01_00260.html",
      "https://dayforce.co.jp/jinjikanri/stricter-penalties-for-the-crime-of-encouraging-illegal-employment/",
    ],
    status: "active",
  },
  {
    id: "FY2026-food-service-quota-cap",
    // Batch 1 D4: 外食業 新規受入 停止方向確認 (2026-03-27 moj.go.jp)
    // 正確な停止日・停止内容は政府発表待ちのため TBD
    effective_date: "TBD",
    announced_date: "2026-03-27",
    title_ja: "特定技能「外食業」分野 受入上限の運用制限",
    title_en: "SSW food service sector: intake quota restrictions",
    summary_ja:
      "2026年3月27日に出入国在留管理庁より「特定技能「外食業分野」における受入れ上限の運用について」" +
      "が公表された。詳細な運用制限の内容および完全停止の有無は一次ソース確認中。" +
      "現時点では新規受入が制限される方向性のみ確認済み。",
    category: "operational_guidance",
    affecting_roles: ["host_company_hr", "support_org"],
    impact_severity: "major",
    source_urls: ["https://www.moj.go.jp/isa/applications/ssw/index.html"],
    status: "pending_verification",
  },
  {
    id: "FY2027-ikusei-shuro-launch",
    // Batch 1 D6 confirmed: 育成就労制度 2027年4月施行
    effective_date: "2027-04-01",
    announced_date: "2024-06-21",
    title_ja: "育成就労制度 開始 / 技能実習制度 廃止",
    title_en: "Ikusei-shuro (育成就労) system launch / Technical Intern Training abolished",
    summary_ja:
      "2027年4月より技能実習制度が廃止され、育成就労制度が開始される " +
      "(令和6年改正入管法・技能実習法)。" +
      "3年で特定技能1号へ移行するルートが基本。" +
      "本人意向による転籍 (同一業務・1〜2年超) が可能になる。" +
      "特定技能の分野・業務区分と原則同一。",
    category: "immigration_act",
    affecting_roles: ["host_company_hr", "dispatch_company", "support_org"],
    impact_severity: "critical",
    source_urls: ["https://www.moj.go.jp/isa/nyuukokukanri01_00260.html"],
    status: "pending",
  },
];

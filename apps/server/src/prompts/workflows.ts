import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// プロンプト引数の入力補完候補 (自然言語の日本語。新人スタッフが選びやすい代表値)。
// Curated Japanese completion candidates for prompt arguments (non-technical staff UX).
// Kandidat pelengkapan otomatis berbahasa Jepang untuk argumen prompt.
const CURRENT_STATUS_SUGGESTIONS = [
  "技能実習2号",
  "技能実習3号",
  "技能実習1号",
  "特定技能1号",
  "留学",
  "技人国",
  "家族滞在",
  "特定活動",
  "海外在住",
  "未確認",
] as const;

const TARGET_STATUS_SUGGESTIONS = ["特定技能1号", "特定技能2号", "技人国"] as const;

const INDUSTRY_SUGGESTIONS = [
  "農業",
  "漁業",
  "飲食料品製造業",
  "外食業",
  "建設",
  "介護",
  "ビルクリーニング",
  "工業製品製造業",
  "造船・舶用工業",
  "自動車整備",
  "航空",
  "宿泊",
  "自動車運送業",
  "鉄道",
  "林業",
  "木材産業",
] as const;

const NOTIFICATION_EVENT_SUGGESTIONS = [
  "雇用契約変更",
  "雇用契約終了",
  "支援計画変更",
  "所属機関変更",
  "所属機関所在地変更",
  "定期届出",
] as const;

const VISA_CATEGORY_SUGGESTIONS = ["特定技能1号", "特定技能2号"] as const;

// 前方一致 (大小文字無視) で候補を絞り込む共通ヘルパ。
// Prefix filter (case-insensitive) shared by all prompt-arg completers.
export function prefixFilter(
  candidates: readonly string[],
): (value: string | undefined) => string[] {
  return (value: string | undefined) => {
    const v = (value ?? "").trim().toLowerCase();
    if (v.length === 0) {
      return [...candidates];
    }
    return candidates.filter((c) => c.toLowerCase().startsWith(v));
  };
}

function userPrompt(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text,
        },
      },
    ],
  };
}

type NewStaffIntakePromptArgs = {
  current_status: string;
  target_status: string;
  industry: string;
  intended_work?: string | undefined;
  reference_year_month?: string | undefined;
};

export function buildNewStaffIntakePromptText(args: NewStaffIntakePromptArgs): string {
  return [
    "SSW Compass を使って、新人スタッフ向けの初回確認をしてください。",
    "個人情報は扱わず、一般情報として公式情報源に基づいて整理してください。",
    "",
    `現在の在留資格/状況: ${args.current_status}`,
    `目標の在留資格: ${args.target_status}`,
    `分野: ${args.industry}`,
    `予定業務: ${args.intended_work ?? "未確認"}`,
    `基準年月: ${args.reference_year_month ?? "未確認"}`,
    "",
    "確認手順:",
    "1. classify_procedure で、認定・変更・更新のどれに近いかを確認する。",
    "2. list_visa_documents で、第1表・第2表・第3表、分野別書類、省略候補を確認する。",
    "3. get_deadline_timeline で、更新申請・随時届出・定期届出の期限を確認する。",
    "4. validate_zairyu_compatibility で、現在の在留資格と予定業務の就労リスクを確認する。",
    "5. list_law_updates で、直近の制度変更が関係するか確認する。",
    "",
    "回答フォーマット:",
    "- まず結論を3行以内で示す。",
    "- 次に『新人が次に確認すること』を番号付きで出す。",
    "- 『責任者・行政書士に確認すること』を分ける。",
    "- 在留カード番号、パスポート番号、氏名、生年月日などの入力を求めない。",
    "- 最後に、SSW Compass は一般情報であり個別判断ではないことを明記する。",
  ].join("\n");
}

export function registerWorkflowPrompts(server: McpServer): void {
  server.registerPrompt(
    "ssw_new_staff_intake_check",
    {
      title: "SSW new staff intake check",
      description:
        "新人・派遣担当が個人情報を入れずに、申請種別、必要書類、期限、就労リスク、エスカレーション要否を順番に確認する社内標準ワークフロー。",
      argsSchema: {
        current_status: completable(
          z.string().describe("現在の在留資格や状況。例: 技能実習2号、留学、海外在住、未確認"),
          prefixFilter(CURRENT_STATUS_SUGGESTIONS),
        ),
        target_status: completable(
          z.string().default("特定技能1号").describe("目標の在留資格"),
          prefixFilter(TARGET_STATUS_SUGGESTIONS),
        ),
        industry: completable(
          z.string().describe("希望する特定技能分野。例: 農業、建設、介護"),
          prefixFilter(INDUSTRY_SUGGESTIONS),
        ),
        intended_work: z
          .string()
          .optional()
          .describe("予定業務の概要。個人名・在留カード番号は入れない"),
        reference_year_month: z
          .string()
          .optional()
          .describe("期限確認の基準年月。例: 2026-07。日付・生年月日は入れない"),
      },
    },
    (args) => userPrompt(buildNewStaffIntakePromptText(args)),
  );

  server.registerPrompt(
    "ssw_route_and_documents",
    {
      title: "SSW route and documents",
      description:
        "特定技能の申請種別を判定し、第1表/第2表/第3表、母国語確認、試験免除、届出期限まで確認する標準ワークフロー。",
      argsSchema: {
        current_status: completable(
          z.string().describe("現在の在留資格。例: 技能実習2号、技人国、海外在住"),
          prefixFilter(CURRENT_STATUS_SUGGESTIONS),
        ),
        target_status: completable(
          z.string().default("特定技能1号").describe("目標の在留資格"),
          prefixFilter(TARGET_STATUS_SUGGESTIONS),
        ),
        industry: completable(
          z.string().describe("希望する特定技能分野。例: 農業、建設、介護"),
          prefixFilter(INDUSTRY_SUGGESTIONS),
        ),
        receiving_organization_profile: z
          .string()
          .optional()
          .describe("受入機関の状況。例: 法人、上場企業、同一年度2人目以降"),
      },
    },
    (args) =>
      userPrompt(
        [
          "SSW Compass の標準ワークフローで確認してください。",
          `現在の在留資格: ${args.current_status}`,
          `目標の在留資格: ${args.target_status}`,
          `分野: ${args.industry}`,
          `受入機関の状況: ${args.receiving_organization_profile ?? "未確認"}`,
          "",
          "手順:",
          "1. classify_procedure で申請種別と必要な表を確認する。",
          "2. 第2表の省略条件を、同一年度2人目以降・第2表の1対象機関・法人・個人事業主で確認する。",
          "3. 技能実習2号/3号からの移行なら、良好修了と職種・作業が特定技能分野と同一対応かを確認する。",
          "4. list_visa_documents で必要書類、母国語確認/多言語様式、分野別第3表を確認する。",
          "5. get_deadline_timeline で更新・随時届出・定期届出の期限を確認する。",
          "6. 回答では個別判断ではなく、公式情報に基づく一般案内として標準免責を添える。",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "ssw_notification_deadlines",
    {
      title: "SSW notification deadlines",
      description:
        "雇用契約変更・支援計画変更・所属機関変更・定期届出などの届出期限と関連様式を確認するワークフロー。",
      argsSchema: {
        event: completable(
          z
            .string()
            .describe("届出事由。例: 支援計画変更、雇用契約終了、所属機関所在地変更、定期届出"),
          prefixFilter(NOTIFICATION_EVENT_SUGGESTIONS),
        ),
        visa_category: completable(
          z.string().default("特定技能1号").describe("対象の在留資格"),
          prefixFilter(VISA_CATEGORY_SUGGESTIONS),
        ),
      },
    },
    (args) =>
      userPrompt(
        [
          "SSW Compass で届出期限と関連様式を確認してください。",
          `届出事由: ${args.event}`,
          `在留資格: ${args.visa_category}`,
          "",
          "手順:",
          "1. get_deadline_timeline で該当する eventContext を選ぶ。",
          "2. 14日以内の随時届出か、毎年4月1日〜5月31日の定期届出かを明確にする。",
          "3. structuredContent.deadlines[].relatedForms の公式様式リンクを確認する。",
          "4. 個別案件の最終判断は行政書士・入管への確認が必要であることを明記する。",
        ].join("\n"),
      ),
  );
}

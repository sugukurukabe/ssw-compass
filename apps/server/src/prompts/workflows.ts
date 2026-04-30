import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

export function registerWorkflowPrompts(server: McpServer): void {
  server.registerPrompt(
    "ssw_route_and_documents",
    {
      title: "SSW route and documents",
      description:
        "特定技能の申請種別を判定し、第1表/第2表/第3表、母国語確認、試験免除、届出期限まで確認する標準ワークフロー。",
      argsSchema: {
        current_status: z.string().describe("現在の在留資格。例: 技能実習2号、技人国、海外在住"),
        target_status: z.string().default("特定技能1号").describe("目標の在留資格"),
        industry: z.string().describe("希望する特定技能分野。例: 農業、建設、介護"),
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
        event: z
          .string()
          .describe("届出事由。例: 支援計画変更、雇用契約終了、所属機関所在地変更、定期届出"),
        visa_category: z.string().default("特定技能1号").describe("対象の在留資格"),
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

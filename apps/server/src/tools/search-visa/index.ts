import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SearchVisaInputV4,
  SearchVisaOutput,
  type SswCompassToolAnnotation,
} from "@ssw/shared-types";
import { SSW_COMPASS_TOOL_ICONS } from "../metadata.js";
import { searchVisa } from "./handler.js";

const UI_RESOURCE_URI = "ui://compass/search/1.0.0.html";

export const SEARCH_VISA_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "Search Japanese visa procedures",
  legalLevel: "L0",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H07_PII_AUTO_MASKING", "H10_LAW_AUTO_UPDATE"],
  tier: "free",
};

export function registerSearchVisaTool(server: McpServer): void {
  registerAppTool(
    server,
    "search_visa",
    {
      title: "Search Japanese visa procedures",
      description:
        "Returns Japanese Specified Skilled Worker (特定技能) and related visa " +
        "procedures grounded in 出入国在留管理庁 official documents. " +
        "Use when the user asks about visa categories, document checklists, or " +
        "deadlines. Information only — does not constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: SearchVisaInputV4.shape,
      outputSchema: SearchVisaOutput,
      annotations: SEARCH_VISA_ANNOTATION,
      _meta: {
        icons: SSW_COMPASS_TOOL_ICONS,
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "公式情報源を確認中…",
        "openai/toolInvocation/invoked": "結果を表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    searchVisa,
  );
}

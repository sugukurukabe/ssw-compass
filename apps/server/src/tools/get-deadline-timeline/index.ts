import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetDeadlineTimelineInputV4, type SswCompassToolAnnotation } from "@ssw/shared-types";
import { getDeadlineTimelineHandler } from "./handler.js";

const UI_RESOURCE_URI = "ui://ssw-timeline/mcp-app.html";

export const GET_DEADLINE_TIMELINE_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "Get Japanese visa statutory deadline timeline",
  legalLevel: "L1",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H07_PII_AUTO_MASKING", "H10_LAW_AUTO_UPDATE"],
  tier: "free",
};

export function registerGetDeadlineTimelineTool(server: McpServer): void {
  registerAppTool(
    server,
    "get_deadline_timeline",
    {
      title: "Get Japanese visa statutory deadline timeline",
      description:
        "Returns the statutory deadline timeline (notifications of changes within 14 days, " +
        "annual report April 1 – May 31, earliest renewal 3 months before expiry, " +
        "Specified Skilled Worker (i) 5-year cumulative cap, specified-activity bridge " +
        "approximately 4 months) for Japanese SSW-class visas, grounded in 出入国在留管理庁 " +
        "official rules. " +
        "Use when the user asks when to file a notification, when to file a renewal, or how " +
        "the overall visa timeline looks. Information only — does not constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: GetDeadlineTimelineInputV4.shape,
      annotations: GET_DEADLINE_TIMELINE_ANNOTATION,
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "期限タイムラインを確認中…",
        "openai/toolInvocation/invoked": "タイムラインを表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    getDeadlineTimelineHandler,
  );
}

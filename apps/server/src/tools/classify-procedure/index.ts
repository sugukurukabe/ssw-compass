import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { classifyProcedureHandler } from "./handler.js";
import { ClassifyProcedureInput } from "./schema.js";

const UI_RESOURCE_URI = "ui://ssw-classify/mcp-app.html";

export function registerClassifyProcedureTool(server: McpServer): void {
  registerAppTool(
    server,
    "classify_procedure",
    {
      title: "Classify Japanese visa procedure type",
      description:
        "Returns the Japanese visa procedure type (certificate of eligibility issuance / " +
        "status change / period renewal / specified-activity bridge) the user likely needs, " +
        "grounded in 出入国在留管理庁 official procedure rules. " +
        "Use when the user asks which procedure they need given a current status, target " +
        "status, and location. Information only — does not constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: ClassifyProcedureInput.shape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "申請種別を判定中…",
        "openai/toolInvocation/invoked": "判定結果を表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    classifyProcedureHandler,
  );
}

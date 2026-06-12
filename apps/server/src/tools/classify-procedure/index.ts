import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClassifyProcedureOutput, type SswCompassToolAnnotation } from "@ssw/shared-types";
import { SSW_COMPASS_TOOL_ICONS } from "../metadata.js";
import { classifyProcedureHandler } from "./handler.js";
import { ClassifyProcedureInput } from "./schema.js";

const UI_RESOURCE_URI = "ui://compass/classify/1.0.0.html";

export const CLASSIFY_PROCEDURE_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "Classify Japanese visa procedure type",
  legalLevel: "L1",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H07_PII_AUTO_MASKING", "H09_TEMPLATE_VS_INDIVIDUAL", "H10_LAW_AUTO_UPDATE"],
  tier: "free",
};

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
      outputSchema: ClassifyProcedureOutput,
      annotations: CLASSIFY_PROCEDURE_ANNOTATION,
      _meta: {
        icons: SSW_COMPASS_TOOL_ICONS,
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

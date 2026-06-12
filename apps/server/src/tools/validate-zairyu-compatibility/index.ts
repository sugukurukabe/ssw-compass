import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type SswCompassToolAnnotation,
  ValidateZairyuCompatibilityInput,
  ValidateZairyuCompatibilityOutput,
} from "@ssw/shared-types";
import { SSW_COMPASS_TOOL_ICONS } from "../metadata.js";
import { validateZairyuCompatibilityHandler } from "./handler.js";

const UI_RESOURCE_URI = "ui://compass/validate/1.0.0.html";

export const VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "Validate zairyu status compatibility",
  legalLevel: "L1",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H06_ILLEGAL_WORK_ALERT", "H07_PII_AUTO_MASKING"],
  tier: "free",
};

export function registerValidateZairyuCompatibilityTool(server: McpServer): void {
  registerAppTool(
    server,
    "validate_zairyu_compatibility",
    {
      title: "Validate zairyu status compatibility",
      description:
        "在留資格と想定就労の適合性を判定する (H06 不法就労判定アラート)。" +
        "Validate compatibility between residence status and intended employment.",
      inputSchema: ValidateZairyuCompatibilityInput.shape,
      outputSchema: ValidateZairyuCompatibilityOutput,
      annotations: VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
      _meta: {
        icons: SSW_COMPASS_TOOL_ICONS,
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "在留資格と業務の適合性を確認中…",
        "openai/toolInvocation/invoked": "適合性を表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    validateZairyuCompatibilityHandler,
  );
}

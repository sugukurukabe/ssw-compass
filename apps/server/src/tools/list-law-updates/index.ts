import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListLawUpdatesInput,
  ListLawUpdatesOutput,
  type SswCompassToolAnnotation,
} from "@ssw/shared-types";
import { SSW_COMPASS_TOOL_ICONS } from "../metadata.js";
import { listLawUpdatesHandler } from "./handler.js";

export const LIST_LAW_UPDATES_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "List Japanese visa law updates",
  legalLevel: "L0",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H07_PII_AUTO_MASKING", "H10_LAW_AUTO_UPDATE"],
  tier: "free",
};

export function registerListLawUpdatesTool(server: McpServer): void {
  server.registerTool(
    "list_law_updates",
    {
      description:
        "制度変動フィードを返す。入管法改正・手数料改定・様式改正・運用要領変更などの公式情報を提供する。" +
        "Return official-source updates such as immigration act changes, fee revisions, form revisions, and operational guidance. Information only — does not constitute legal advice. Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      title: LIST_LAW_UPDATES_ANNOTATION.title,
      inputSchema: ListLawUpdatesInput,
      outputSchema: ListLawUpdatesOutput,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: { icons: SSW_COMPASS_TOOL_ICONS },
    },
    listLawUpdatesHandler,
  );
}

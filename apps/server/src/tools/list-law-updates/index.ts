import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListLawUpdatesInput, type SswCompassToolAnnotation } from "@ssw/shared-types";
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
  server.tool(
    "list_law_updates",
    "制度変動フィードを返す。入管法改正・手数料改定・様式改正・運用要領変更などの公式情報を提供する。" +
      "Return official-source updates such as immigration act changes, fee revisions, form revisions, and operational guidance.",
    ListLawUpdatesInput.shape,
    {
      title: LIST_LAW_UPDATES_ANNOTATION.title,
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    listLawUpdatesHandler,
  );
}

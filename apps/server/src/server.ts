import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChecklistSchemaTool } from "./tools/_internal/checklist-schema.js";
import { registerClassifyProcedureTool } from "./tools/classify-procedure/index.js";
import { registerClassifyProcedureUiResource } from "./tools/classify-procedure/ui.js";
import { registerGetDeadlineTimelineTool } from "./tools/get-deadline-timeline/index.js";
import { registerGetDeadlineTimelineUiResource } from "./tools/get-deadline-timeline/ui.js";
import { registerListVisaDocumentsTool } from "./tools/list-visa-documents/index.js";
import { registerListVisaDocumentsUiResource } from "./tools/list-visa-documents/ui.js";
import { registerSearchVisaTool } from "./tools/search-visa/index.js";
import { registerSearchVisaUiResource } from "./tools/search-visa/ui.js";

const SERVER_INFO = {
  name: "ssw-mcp",
  version: "1.0.0",
} as const;

export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
    },
  });
  registerSearchVisaTool(server);
  registerSearchVisaUiResource(server);
  registerClassifyProcedureTool(server);
  registerClassifyProcedureUiResource(server);
  registerGetDeadlineTimelineTool(server);
  registerGetDeadlineTimelineUiResource(server);
  registerListVisaDocumentsTool(server);
  registerListVisaDocumentsUiResource(server);
  registerChecklistSchemaTool(server);
  return server;
}

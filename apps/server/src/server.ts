import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerClassifyProcedureTool } from "./tools/classify-procedure/index.js";
import { registerClassifyProcedureUiResource } from "./tools/classify-procedure/ui.js";
import { registerGetDeadlineTimelineTool } from "./tools/get-deadline-timeline/index.js";
import { registerGetDeadlineTimelineUiResource } from "./tools/get-deadline-timeline/ui.js";
import { registerSearchVisaTool } from "./tools/search-visa/index.js";
import { registerSearchVisaUiResource } from "./tools/search-visa/ui.js";

const SERVER_INFO = {
  name: "vcj-mcp",
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
  return server;
}

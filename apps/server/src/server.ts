import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
  return server;
}

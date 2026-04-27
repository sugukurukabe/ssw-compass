import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml } from "../../ui-assets.js";

const UI_RESOURCE_URI = "ui://vcj-timeline/mcp-app.html";

export function registerGetDeadlineTimelineUiResource(server: McpServer): void {
  registerAppResource(
    server,
    "vcj-timeline-ui",
    UI_RESOURCE_URI,
    {
      description: "Visa Compass Japan — deadline timeline UI",
    },
    async () => {
      const text = await loadUiHtml("vcj-timeline");
      return {
        contents: [
          {
            uri: UI_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                  frameDomains: [],
                  baseUriDomains: [],
                },
              },
            },
          },
        ],
      };
    },
  );
}

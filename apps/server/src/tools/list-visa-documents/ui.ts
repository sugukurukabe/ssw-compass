import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml } from "../../ui-assets.js";

const UI_RESOURCE_URI = "ui://ssw-checklist/mcp-app.html";

export function registerListVisaDocumentsUiResource(server: McpServer): void {
  registerAppResource(
    server,
    "ssw-checklist-ui",
    UI_RESOURCE_URI,
    {
      description: "SSW Compass — document checklist UI with Commit Moment",
    },
    async () => {
      const text = await loadUiHtml("ssw-checklist");
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

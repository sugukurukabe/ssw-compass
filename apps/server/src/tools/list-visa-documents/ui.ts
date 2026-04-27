import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml } from "../../ui-assets.js";

const UI_RESOURCE_URI = "ui://vcj-checklist/mcp-app.html";

export function registerListVisaDocumentsUiResource(server: McpServer): void {
  registerAppResource(
    server,
    "vcj-checklist-ui",
    UI_RESOURCE_URI,
    {
      description: "Visa Compass Japan — document checklist UI with Commit Moment",
    },
    async () => {
      const text = await loadUiHtml("vcj-checklist");
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

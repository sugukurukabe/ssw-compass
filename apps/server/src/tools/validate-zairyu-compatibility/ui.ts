import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml } from "../../ui-assets.js";

const UI_RESOURCE_URI = "ui://ssw-validate/mcp-app.html";

export function registerValidateZairyuCompatibilityUiResource(server: McpServer): void {
  registerAppResource(
    server,
    "ssw-validate-ui",
    UI_RESOURCE_URI,
    {
      description: "SSW Compass — zairyu compatibility warning UI",
    },
    async () => {
      const text = await loadUiHtml("ssw-validate");
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

import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadUiHtml } from "../../ui-assets.js";
import { buildWidgetResourceMeta } from "../widget-csp.js";

const UI_RESOURCE_URI = "ui://compass/classify/1.0.0.html";
const LEGACY_UI_RESOURCE_URI = "ui://ssw-classify/mcp-app.html";

export function registerClassifyProcedureUiResource(server: McpServer): void {
  for (const [name, uri] of [
    ["ssw-classify-ui", UI_RESOURCE_URI],
    ["ssw-classify-ui-legacy", LEGACY_UI_RESOURCE_URI],
  ] as const) {
    registerAppResource(
      server,
      name,
      uri,
      { description: "SSW Compass — procedure classification UI" },
      async () => {
        const text = await loadUiHtml("ssw-classify");
        return {
          contents: [
            {
              uri,
              mimeType: RESOURCE_MIME_TYPE,
              text,
              _meta: buildWidgetResourceMeta(),
            },
          ],
        };
      },
    );
  }
}

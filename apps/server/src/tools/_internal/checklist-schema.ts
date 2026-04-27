import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Internal helper tool for the vcj-checklist UI. Not intended for LLM
 * invocation. Marked with `_meta.ui.visibility: ["app"]` per MCP Apps spec
 * (ext-apps 1.7.0 McpUiToolMeta), and the description is prefixed with
 * `[INTERNAL]` as a belt-and-braces signal per v3 §23.3 for hosts that do
 * not yet honour the visibility metadata.
 *
 * Sprint 2 Batch 5 wires this as the first VCJ demonstration of the
 * `visibility: ["app"]` pattern. The current body returns a static column
 * order; future Sprint 3 work can extend it with per-locale or per-screen
 * adaptations without exposing it to the LLM.
 */

const UI_RESOURCE_URI = "ui://vcj-checklist/mcp-app.html";

export function registerChecklistSchemaTool(server: McpServer): void {
  registerAppTool(
    server,
    "_vcj_checklist_schema",
    {
      title: "[INTERNAL] checklist column schema",
      description:
        "[INTERNAL] UI helper for vcj-checklist. Returns the stable column order " +
        "so the UI can lay out documents deterministically. Do not invoke directly " +
        "from the agent; this tool is intended to be called by the vcj-checklist UI only.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
          visibility: ["app"],
        },
      },
    },
    async () => {
      const columnOrder = ["label", "category", "ministry", "trustLevel"];
      return {
        content: [{ type: "text", text: JSON.stringify({ columnOrder }) }],
        structuredContent: { columnOrder },
      };
    },
  );
}

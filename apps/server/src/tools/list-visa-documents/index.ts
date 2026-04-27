import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listVisaDocumentsHandler } from "./handler.js";
import { ListVisaDocumentsInput } from "./schema.js";

const UI_RESOURCE_URI = "ui://ssw-checklist/mcp-app.html";

export function registerListVisaDocumentsTool(server: McpServer): void {
  registerAppTool(
    server,
    "list_visa_documents",
    {
      title: "List Japanese visa required documents",
      description:
        "Returns the list of documents typically required to file a Japanese " +
        "SSW-class visa application, grounded in 出入国在留管理庁 and sector-ministry " +
        "guidance. Use when the user asks what documents they need for a specific " +
        "visa category (and optionally industry). Information only — does not " +
        "constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: ListVisaDocumentsInput.shape,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
        "openai/outputTemplate": UI_RESOURCE_URI,
        "openai/toolInvocation/invoking": "必要書類を確認中…",
        "openai/toolInvocation/invoked": "チェックリストを表示しました",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    listVisaDocumentsHandler,
  );
}

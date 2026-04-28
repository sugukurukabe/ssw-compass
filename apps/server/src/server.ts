import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateToolAnnotations } from "./hitl/validate-annotations.js";
import { registerChecklistSchemaTool } from "./tools/_internal/checklist-schema.js";
import {
  CLASSIFY_PROCEDURE_ANNOTATION,
  registerClassifyProcedureTool,
} from "./tools/classify-procedure/index.js";
import { registerClassifyProcedureUiResource } from "./tools/classify-procedure/ui.js";
import {
  GET_DEADLINE_TIMELINE_ANNOTATION,
  registerGetDeadlineTimelineTool,
} from "./tools/get-deadline-timeline/index.js";
import { registerGetDeadlineTimelineUiResource } from "./tools/get-deadline-timeline/ui.js";
import { listLawUpdatesHandler } from "./tools/list-law-updates/handler.js";
import {
  LIST_VISA_DOCUMENTS_ANNOTATION,
  registerListVisaDocumentsTool,
} from "./tools/list-visa-documents/index.js";
import { registerListVisaDocumentsUiResource } from "./tools/list-visa-documents/ui.js";
import { registerSearchVisaTool, SEARCH_VISA_ANNOTATION } from "./tools/search-visa/index.js";
import { registerSearchVisaUiResource } from "./tools/search-visa/ui.js";
import { submitGyoseishoshiApprovalHandler } from "./tools/submit-gyoseishoshi-approval/handler.js";
import { validateZairyuCompatibilityHandler } from "./tools/validate-zairyu-compatibility/handler.js";

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

  // Batch 9: list_law_updates (L0, Free)
  server.tool(
    "list_law_updates",
    "制度変動フィードを返す。行政書士法改正・入管法改正・手数料改定などの最新情報を提供する。" +
      "Return law updates feed: gyoseishoshi law revisions, immigration act changes, fee revisions, etc.",
    {},
    listLawUpdatesHandler,
  );

  // Batch 10: submit_gyoseishoshi_approval (L2, Pro + gyoseishoshi)
  server.tool(
    "submit_gyoseishoshi_approval",
    "行政書士が書類ドラフトを最終承認する。改正行政書士法§19 に基づき Pro + 行政書士認証が必須。" +
      "Gyoseishoshi final approval for a draft document. Requires Pro + gyoseishoshi auth per §19.",
    {},
    submitGyoseishoshiApprovalHandler,
  );

  // Batch 10: validate_zairyu_compatibility (L1, Free — 情報提供)
  server.tool(
    "validate_zairyu_compatibility",
    "在留資格と想定就労の適合性を判定する (H06 不法就労判定アラート)。" +
      "Validate compatibility between residence status and intended employment (H06 illegal work alert).",
    {},
    validateZairyuCompatibilityHandler,
  );

  // ADR-014 §5: validate all registered tool annotations at startup.
  // The annotation objects are exported from each tool registration file
  // (SEARCH_VISA_ANNOTATION etc.) so we can validate without calling
  // a non-existent server.listTools(). Any L2/L3 mis-configuration
  // throws ToolAnnotationConfigError → server fails to start.
  validateToolAnnotations([
    { name: "search_visa", annotations: SEARCH_VISA_ANNOTATION },
    { name: "classify_procedure", annotations: CLASSIFY_PROCEDURE_ANNOTATION },
    { name: "get_deadline_timeline", annotations: GET_DEADLINE_TIMELINE_ANNOTATION },
    { name: "list_visa_documents", annotations: LIST_VISA_DOCUMENTS_ANNOTATION },
  ]);

  return server;
}

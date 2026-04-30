import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SswCompassToolAnnotation } from "@ssw/shared-types";
import { validateToolAnnotations } from "./hitl/validate-annotations.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";
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
import {
  LIST_LAW_UPDATES_ANNOTATION,
  registerListLawUpdatesTool,
} from "./tools/list-law-updates/index.js";
import {
  LIST_VISA_DOCUMENTS_ANNOTATION,
  registerListVisaDocumentsTool,
} from "./tools/list-visa-documents/index.js";
import { registerListVisaDocumentsUiResource } from "./tools/list-visa-documents/ui.js";
import { registerSearchVisaTool, SEARCH_VISA_ANNOTATION } from "./tools/search-visa/index.js";
import { registerSearchVisaUiResource } from "./tools/search-visa/ui.js";
import { submitGyoseishoshiApprovalHandler } from "./tools/submit-gyoseishoshi-approval/handler.js";
import {
  registerValidateZairyuCompatibilityTool,
  VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
} from "./tools/validate-zairyu-compatibility/index.js";
import { registerValidateZairyuCompatibilityUiResource } from "./tools/validate-zairyu-compatibility/ui.js";

const SERVER_INFO = {
  name: "ssw-mcp",
  version: "1.0.0",
} as const;

const SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
  destructiveHint: false,
  title: "Submit gyoseishoshi draft approval",
  legalLevel: "L2",
  requiresGyoseishoshiAuth: true,
  hitlControls: ["H01_DRAFT_LOCKGATE", "H03_GYOSEISHOSHI_APPROVAL", "H04_AUDIT_LOG_7Y"],
  tier: "pro",
};

export function createMcpServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
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
  registerValidateZairyuCompatibilityTool(server);
  registerValidateZairyuCompatibilityUiResource(server);

  registerListLawUpdatesTool(server);
  registerWorkflowPrompts(server);

  // Batch 10: submit_gyoseishoshi_approval (L2, Pro + gyoseishoshi)
  server.tool(
    "submit_gyoseishoshi_approval",
    "行政書士が書類ドラフトを最終承認する。改正行政書士法§19 に基づき Pro + 行政書士認証が必須。" +
      "Gyoseishoshi final approval for a draft document. Requires Pro + gyoseishoshi auth per §19.",
    {},
    {
      title: SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION.title,
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
    submitGyoseishoshiApprovalHandler,
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
    { name: "list_law_updates", annotations: LIST_LAW_UPDATES_ANNOTATION },
    { name: "submit_gyoseishoshi_approval", annotations: SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION },
    {
      name: "validate_zairyu_compatibility",
      annotations: VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
    },
  ]);

  return server;
}

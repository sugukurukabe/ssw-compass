import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { validateToolAnnotations } from "./hitl/validate-annotations.js";
import { registerWorkflowPrompts } from "./prompts/workflows.js";
import { registerCatalogResources } from "./resources/catalogs.js";
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
  GET_PACKAGE_STATUS_ANNOTATION,
  registerGetPackageStatusTool,
} from "./tools/get-package-status/index.js";
import {
  LIST_LAW_UPDATES_ANNOTATION,
  registerListLawUpdatesTool,
} from "./tools/list-law-updates/index.js";
import {
  LIST_VISA_DOCUMENTS_ANNOTATION,
  registerListVisaDocumentsTool,
} from "./tools/list-visa-documents/index.js";
import { registerListVisaDocumentsUiResource } from "./tools/list-visa-documents/ui.js";
import {
  PREPARE_DOCUMENT_PACKAGE_ANNOTATION,
  registerPrepareDocumentPackageTool,
} from "./tools/prepare-document-package/index.js";
import { registerSearchVisaTool, SEARCH_VISA_ANNOTATION } from "./tools/search-visa/index.js";
import { registerSearchVisaUiResource } from "./tools/search-visa/ui.js";
import {
  registerSubmitGyoseishoshiApprovalTool,
  SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION,
} from "./tools/submit-gyoseishoshi-approval/index.js";
import {
  registerValidateZairyuCompatibilityTool,
  VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
} from "./tools/validate-zairyu-compatibility/index.js";
import { registerValidateZairyuCompatibilityUiResource } from "./tools/validate-zairyu-compatibility/ui.js";

// T10 ③: serverInfo.version を Server Card の `version` (2.1.0) に統一する。
// クライアントによっては initialize の serverInfo.version と Server Card version の
// 不一致を検証エラー扱いにするため、製品現行版 2.1.0 に揃える
// (apps/server/package.json と server/discover の serverInfo も同値)。
// openapi.json の info.version (4.0.0) は OpenAPI ドキュメント版として別管理 (役割が異なる)。
// T10 ③: unify serverInfo.version with the Server Card `version` (2.1.0).
// T10 ③: samakan serverInfo.version dengan `version` Server Card (2.1.0).
const SERVER_INFO = {
  name: "ssw-mcp",
  version: "2.1.0",
} as const;

export interface CreateMcpServerOptions {
  includeProTools?: boolean;
}

export function createMcpServer(options: CreateMcpServerOptions = {}): McpServer {
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
  if (options.includeProTools === true) {
    registerSubmitGyoseishoshiApprovalTool(server);
    registerPrepareDocumentPackageTool(server);
    registerGetPackageStatusTool(server);
  }
  registerWorkflowPrompts(server);
  registerCatalogResources(server);

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
    {
      name: "validate_zairyu_compatibility",
      annotations: VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
    },
    {
      name: "submit_gyoseishoshi_approval",
      annotations: SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION,
    },
    {
      name: "prepare_document_package",
      annotations: PREPARE_DOCUMENT_PACKAGE_ANNOTATION,
    },
    {
      name: "get_package_status",
      annotations: GET_PACKAGE_STATUS_ANNOTATION,
    },
  ]);

  return server;
}

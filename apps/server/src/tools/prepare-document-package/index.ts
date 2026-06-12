/**
 * prepare_document_package ツール登録
 * Registration for the prepare_document_package tool
 * Pendaftaran alat prepare_document_package
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PrepareDocumentPackageInput,
  PrepareDocumentPackageOutput,
  type SswCompassToolAnnotation,
} from "@ssw/shared-types";
import { prepareDocumentPackageHandler } from "./handler.js";

export const PREPARE_DOCUMENT_PACKAGE_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: true,
  destructiveHint: false,
  title: "Prepare SSW document package",
  legalLevel: "L2",
  requiresGyoseishoshiAuth: true,
  hitlControls: ["H01_DRAFT_LOCKGATE", "H04_AUDIT_LOG_7Y", "H07_PII_AUTO_MASKING"],
  tier: "pro",
};

export function registerPrepareDocumentPackageTool(server: McpServer): void {
  server.registerTool(
    "prepare_document_package",
    {
      title: PREPARE_DOCUMENT_PACKAGE_ANNOTATION.title,
      description:
        "申請書類パッケージを生成し、GCS の短期署名付き URL を返す。" +
        "Returns a generated SSW document package stored in GCS. Use this when the user asks to prepare a document package for a case handle. Information only — does not constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: PrepareDocumentPackageInput,
      outputSchema: PrepareDocumentPackageOutput,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
      _meta: {
        icons: [
          {
            src: "https://mcp.ssw-compass.jp/.well-known/icon-192.png",
            mimeType: "image/png",
            sizes: ["192x192"],
          },
        ],
      },
    },
    prepareDocumentPackageHandler,
  );
}

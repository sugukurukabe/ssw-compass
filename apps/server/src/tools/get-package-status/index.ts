/**
 * get_package_status ツール登録
 * Registration for the get_package_status tool
 * Pendaftaran alat get_package_status
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetPackageStatusInput,
  GetPackageStatusOutput,
  type SswCompassToolAnnotation,
} from "@ssw/shared-types";
import { getPackageStatusHandler } from "./handler.js";

export const GET_PACKAGE_STATUS_ANNOTATION: SswCompassToolAnnotation = {
  // 状態照会と署名 URL 再発行のみ。GCS/Supabase の状態を変更しないため read-only。
  // Status read + signed-URL re-issue only; no state mutation, so read-only.
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
  destructiveHint: false,
  title: "Get SSW document package status",
  legalLevel: "L2",
  requiresGyoseishoshiAuth: true,
  hitlControls: ["H01_DRAFT_LOCKGATE", "H04_AUDIT_LOG_7Y", "H07_PII_AUTO_MASKING"],
  tier: "pro",
};

export function registerGetPackageStatusTool(server: McpServer): void {
  server.registerTool(
    "get_package_status",
    {
      title: GET_PACKAGE_STATUS_ANNOTATION.title,
      description:
        "prepare_document_package で生成した書類パッケージの状態を idempotency_key で照会し、" +
        "完了済みなら新しい短期署名付き URL を返す。" +
        "Returns the status of a document package previously created with prepare_document_package, " +
        "re-issuing a fresh signed URL when completed. Scoped to the calling principal. " +
        "Information only — does not constitute legal advice. " +
        "Does not accept personal identifiers (residence card numbers, passport numbers, individual numbers).",
      inputSchema: GetPackageStatusInput,
      outputSchema: GetPackageStatusOutput,
      annotations: {
        readOnlyHint: true,
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
    getPackageStatusHandler,
  );
}

/**
 * submit_gyoseishoshi_approval ツール登録 (v4 §3.4 / ADR-014 L2 / GAT-6)
 * Registration of submit_gyoseishoshi_approval tool
 * Pendaftaran alat submit_gyoseishoshi_approval
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type SswCompassToolAnnotation, SubmitGyoseishoshiApprovalInput } from "@ssw/shared-types";
import type { ZodRawShape } from "zod";
import { submitGyoseishoshiApprovalHandler } from "./handler.js";

export const SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION: SswCompassToolAnnotation = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
  destructiveHint: false,
  title: "Submit gyoseishoshi approval for drafted documents",
  legalLevel: "L2",
  requiresGyoseishoshiAuth: true,
  hitlControls: ["H01_DRAFT_LOCKGATE", "H04_AUDIT_LOG_7Y", "H07_PII_AUTO_MASKING"],
  tier: "pro",
};

// ZodEffects (.refine) wraps ZodObject; extract the inner .shape for MCP registration.
const INNER_SCHEMA = (
  SubmitGyoseishoshiApprovalInput as unknown as {
    _def: { schema: { shape: ZodRawShape } };
  }
)._def.schema.shape;

export function registerSubmitGyoseishoshiApprovalTool(server: McpServer): void {
  server.tool(
    "submit_gyoseishoshi_approval",
    "行政書士による書類承認を記録する。改正行政書士法§19 に基づき " +
      "Pro tier かつ gyoseishoshi_verified=true のユーザーのみ利用可能 (L2)。" +
      "Records gyoseishoshi approval. Requires Pro + gyoseishoshi_verified (L2). " +
      "Mencatat persetujuan gyoseishoshi. Memerlukan Pro + gyoseishoshi_verified (L2).",
    INNER_SCHEMA,
    {
      title: SUBMIT_GYOSEISHOSHI_APPROVAL_ANNOTATION.title,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
    submitGyoseishoshiApprovalHandler,
  );
}

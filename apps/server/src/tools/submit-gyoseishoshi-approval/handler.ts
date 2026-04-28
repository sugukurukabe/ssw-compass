/**
 * submit_gyoseishoshi_approval handler (v4 §3.4 / ADR-014 L2 / ADR-015 H04)
 *
 * legalLevel: L2 (Pro + gyoseishoshi_verified 必須)
 * H04_AUDIT_LOG_7Y: emitAuditEvent を response 組み立て前に必ず呼ぶ。
 *
 * Sprint 4 スコープ:
 * - checkbox_only / checkbox_with_seal の 2 方式を実装
 * - esign は Sprint 5 以降 (NotImplementedError)
 * - 職印 OCR (行政書士登録番号照合) は Sprint 5 以降 (manual approval fallback)
 * - seal_image_base64 は hash 化して監査ログに記録、画像本体は保存しない
 */

import { createHash } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  type AuditEventType,
  DISCLAIMER_BY_LANG,
  SubmitGyoseishoshiApprovalInput,
  type SupportedLanguage,
} from "@ssw/shared-types";
import type { Request } from "express";
import { emitAuditEvent, sha256Hex } from "../../audit/writer.js";
import { assertHitlGate } from "../../hitl/lockgate.js";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";

/**
 * テスト可能な内部実装 (instrumentTool の外)
 * Testable inner implementation outside instrumentTool
 */
export async function _submitGyoseishoshiApprovalInner(
  rawArgs: unknown,
  authContext?: import("@ssw/shared-types").AuthContextType | null,
): Promise<CallToolResult> {
  const args = SubmitGyoseishoshiApprovalInput.parse(rawArgs);
  assertHitlGate(authContext ?? null, "submit_gyoseishoshi_approval", "L2");
  if (args.approval_method === "esign") {
    throw new Error(
      "esign approval is not implemented in Sprint 4. Use checkbox_only or checkbox_with_seal.",
    );
  }
  const sealImageHash = args.seal_image_base64
    ? createHash("sha256").update(args.seal_image_base64).digest("hex")
    : undefined;
  const auditEvent: AuditEventType = {
    timestamp: new Date().toISOString(),
    actor: {
      user_id_hash: sha256Hex(authContext?.user_id ?? "anonymous"),
      tier: authContext?.tier ?? "free",
      gyoseishoshi_number: authContext?.gyoseishoshi_number,
    },
    action: "draft_approved",
    case_id: args.case_id,
    tool_id: "submit_gyoseishoshi_approval",
    legal_level: "L2",
    input_hash: sha256Hex({ case_id: args.case_id, draft_document_id: args.draft_document_id }),
    output_hash: sha256Hex({ approved: true, method: args.approval_method }),
    approval_signature: {
      method: args.approval_method,
      seal_image_hash: sealImageHash,
      ip_address_hash: undefined,
    },
    schema_version: "v1",
  };
  emitAuditEvent(auditEvent);
  logger.info(
    {
      tool: "submit_gyoseishoshi_approval",
      case_id: args.case_id,
      method: args.approval_method,
      approver_number: args.approver_gyoseishoshi_number,
    },
    "draft_approved",
  );
  const lang = args.language as SupportedLanguage;
  const disclaimer = DISCLAIMER_BY_LANG[lang];
  return {
    content: [
      {
        type: "text",
        text:
          `承認が完了しました。\n` +
          `case_id: ${args.case_id}\n` +
          `承認方式: ${args.approval_method}\n` +
          `承認者: ${args.approver_gyoseishoshi_number}\n` +
          `\n${disclaimer}`,
      },
    ],
    structuredContent: {
      approved: true,
      case_id: args.case_id,
      draft_document_id: args.draft_document_id,
      approval_method: args.approval_method,
      approver_gyoseishoshi_number: args.approver_gyoseishoshi_number,
      audit_event_recorded: true,
      disclaimer,
    },
  };
}

export const submitGyoseishoshiApprovalHandler = instrumentTool(
  "submit_gyoseishoshi_approval",
  async (rawArgs: unknown, _extra?: { req?: Request }): Promise<CallToolResult> => {
    const authContext = (
      _extra?.req as { authContext?: import("@ssw/shared-types").AuthContextType } | undefined
    )?.authContext;
    return _submitGyoseishoshiApprovalInner(rawArgs, authContext);
  },
);

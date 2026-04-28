/**
 * submit_gyoseishoshi_approval ツールの入力スキーマ (v4 §3.4 / ADR-014 L2 / sprint-4-plan §3.8)
 * Input schema for submit_gyoseishoshi_approval tool
 * Skema input untuk alat submit_gyoseishoshi_approval
 *
 * Interface Freeze (sprint-4-plan §3.8): Sprint 4 全期間で不変。
 * legalLevel: L2 (Pro + gyoseishoshi_verified=true 必須, assertHitlGate で enforce)
 *
 * H04_AUDIT_LOG_7Y: emitAuditEvent を response 返却前に必ず呼ぶこと (ADR-015)。
 */

import { z } from "zod";
import { CaseId } from "../case-id.js";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";

export const SubmitGyoseishoshiApprovalInput = z
  .object({
    /** 関連 case_id (ADR-014 / nanoid base36) */
    case_id: CaseId,
    /** 承認対象の書類 ID */
    draft_document_id: z.string().regex(/^doc_[a-z0-9]{16}$/),
    /** 承認対象書類のコンテンツ sha256 ハッシュ (ADR-015: 本体は保存しない) */
    draft_content_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    /** 承認方式 */
    approval_method: z.enum(["checkbox_only", "checkbox_with_seal", "esign"]),
    /**
     * 職印画像 (base64、checkbox_with_seal 時必須)
     * Seal image (base64, required for checkbox_with_seal)
     */
    seal_image_base64: z.string().optional(),
    /** 行政書士登録番号 例: "東京都 12345" */
    approver_gyoseishoshi_number: z.string().regex(/^[\u4e00-\u9fa5]+ \d+$/),
    /** 備考 (任意) */
    notes: z.string().max(2000).optional(),
    /** 出力言語 */
    language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
  })
  .strict()
  .refine((d) => d.approval_method !== "checkbox_with_seal" || !!d.seal_image_base64, {
    message: "checkbox_with_seal は職印画像 (seal_image_base64) が必須です",
    path: ["seal_image_base64"],
  });
export type SubmitGyoseishoshiApprovalInput = z.infer<typeof SubmitGyoseishoshiApprovalInput>;

/**
 * SSW Compass 承認状態の型定義
 * Type definitions for SSW Compass approval state
 * Definisi tipe status persetujuan SSW Compass
 */

export const APPROVAL_STEPS = ["staff_review", "gyoseishoshi_approval", "final_execute"] as const;
export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "executed",
  "rejected",
  "expired",
  "escalated",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const DRAFT_STATUSES = ["active", "superseded", "expired", "deleted"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export type TransitionDecision = "approve" | "reject" | "edit" | "expire" | "execute";

export type DraftRecord = {
  id: string;
  case_handle: string;
  sha256: string;
  storage_uri: string | null;
  status: DraftStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ApprovalRequestRecord = {
  id: string;
  draft_id: string;
  draft_sha256: string;
  principal: string;
  step: ApprovalStep;
  parent_id: string | null;
  status: ApprovalStatus;
  decision: TransitionDecision | null;
  idempotency_key: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  trace_id: string | null;
};

export type CreateDraftInput = {
  caseHandle: string;
  sha256: string;
  storageUri?: string;
  expiresAt: Date;
};

export type CreateApprovalRequestInput = {
  draftId: string;
  draftSha256: string;
  /**
   * 行の所有者 principal。**必ず** `sha256Hex(authContext.user_id)` を渡すこと。
   * MRTR (applyApprovalInputResponse) は callerPrincipal = sha256Hex(user_id) と
   * この値を厳密比較する。生の JWT sub 等を入れると全ての承認が principal_mismatch になる。
   *
   * MUST be `sha256Hex(authContext.user_id)`. The MRTR path compares the caller's
   * hashed user id against this value; storing the raw JWT sub (or any other value)
   * makes every legitimate approval fail with principal_mismatch.
   *
   * WAJIB `sha256Hex(authContext.user_id)`. Jalur MRTR membandingkan id pengguna
   * yang di-hash dengan nilai ini; menyimpan nilai lain menyebabkan principal_mismatch.
   */
  principal: string;
  step: ApprovalStep;
  parentId?: string;
  idempotencyKey: string;
  expiresAt: Date;
  traceId?: string;
};

export type TransitionFailureReason =
  | "invalid_transition"
  | "already_decided"
  | "expired"
  | "draft_hash_mismatch"
  | "parent_not_approved"
  | "parent_hash_mismatch";

export type TransitionOk = {
  ok: true;
  nextStatus: ApprovalStatus;
};

export type TransitionFailed = {
  ok: false;
  reason: TransitionFailureReason;
  nextStatus?: ApprovalStatus;
};

export type TransitionResult = TransitionOk | TransitionFailed;

export type ParentApprovalSnapshot = {
  status: ApprovalStatus;
  draftSha256: string;
};

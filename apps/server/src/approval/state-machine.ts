/**
 * 承認状態遷移を純粋関数として評価する
 * Evaluate approval state transitions as pure functions
 * Mengevaluasi transisi status persetujuan sebagai fungsi murni
 */

import type {
  ApprovalStatus,
  ParentApprovalSnapshot,
  TransitionDecision,
  TransitionResult,
} from "./types.js";

const TERMINAL_STATUSES = new Set<ApprovalStatus>(["executed", "rejected", "expired", "escalated"]);

export type EvaluateApprovalTransitionInput = {
  currentStatus: ApprovalStatus;
  decision: TransitionDecision;
  expiresAt: Date;
  now: Date;
  storedDraftSha256: string;
  currentDraftSha256: string;
  parent?: ParentApprovalSnapshot;
  editLoopCount?: number;
};

export function evaluateApprovalTransition(
  input: EvaluateApprovalTransitionInput,
): TransitionResult {
  if (TERMINAL_STATUSES.has(input.currentStatus)) {
    return { ok: false, reason: "already_decided" };
  }

  if (input.decision !== "expire" && input.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: "expired", nextStatus: "expired" };
  }

  if (
    (input.decision === "approve" || input.decision === "execute") &&
    input.parent !== undefined &&
    (input.parent.status !== "approved" || input.parent.draftSha256 !== input.storedDraftSha256)
  ) {
    return {
      ok: false,
      reason: input.parent.status !== "approved" ? "parent_not_approved" : "parent_hash_mismatch",
    };
  }

  if (
    (input.decision === "approve" || input.decision === "execute") &&
    input.currentDraftSha256 !== input.storedDraftSha256
  ) {
    return { ok: false, reason: "draft_hash_mismatch", nextStatus: "rejected" };
  }

  switch (input.decision) {
    case "approve":
      return input.currentStatus === "pending"
        ? { ok: true, nextStatus: "approved" }
        : { ok: false, reason: "invalid_transition" };
    case "reject":
      return input.currentStatus === "pending"
        ? { ok: true, nextStatus: "rejected" }
        : { ok: false, reason: "invalid_transition" };
    case "edit":
      if (input.currentStatus !== "pending") {
        return { ok: false, reason: "invalid_transition" };
      }
      return (input.editLoopCount ?? 0) >= 3
        ? { ok: true, nextStatus: "escalated" }
        : { ok: true, nextStatus: "rejected" };
    case "expire":
      return input.currentStatus === "pending"
        ? { ok: true, nextStatus: "expired" }
        : { ok: false, reason: "invalid_transition" };
    case "execute":
      return input.currentStatus === "approved"
        ? { ok: true, nextStatus: "executed" }
        : { ok: false, reason: "invalid_transition" };
    default: {
      const exhaustiveCheck: never = input.decision;
      return exhaustiveCheck;
    }
  }
}

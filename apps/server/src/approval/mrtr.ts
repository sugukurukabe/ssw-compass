/**
 * MCP Multi Round-Trip 承認ヘルパ
 * MCP multi round-trip approval helpers
 * Helper persetujuan multi round-trip MCP
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { NotificationSink } from "./notification-sink.js";
import { loggingNotificationSink } from "./notification-sink.js";
import { ApprovalRepository } from "./repository.js";
import { evaluateApprovalTransition } from "./state-machine.js";
import type { ApprovalRequestRecord, TransitionDecision } from "./types.js";

export type ApprovalInputRequiredResult = CallToolResult & {
  resultType: "inputRequired";
  inputRequests: {
    approval: {
      type: "elicitation";
      message: string;
      schema: {
        type: "string";
        enum: ["approve", "edit", "reject"];
      };
    };
    edit_note: {
      type: "elicitation";
      message: string;
      schema: {
        type: "string";
        maxLength: 2000;
      };
      required: false;
    };
  };
  requestState: string;
};

export type ApprovalInputResponse = {
  approval: "approve" | "edit" | "reject";
  edit_note?: string | undefined;
};

export type ApplyApprovalResponseResult =
  | { ok: true; status: "approved" | "rejected" | "escalated"; request: ApprovalRequestRecord }
  | { ok: false; reason: string; status?: "rejected" | "expired" | "escalated" };

export type ApprovalStateRepository = Pick<
  ApprovalRepository,
  "getApprovalRequest" | "getDraft" | "transitionPendingApproval"
>;

export function buildApprovalInputRequiredResult(input: {
  requestState: string;
  message: string;
}): ApprovalInputRequiredResult {
  return {
    resultType: "inputRequired",
    requestState: input.requestState,
    inputRequests: {
      approval: {
        type: "elicitation",
        message: input.message,
        schema: { type: "string", enum: ["approve", "edit", "reject"] },
      },
      edit_note: {
        type: "elicitation",
        message: "編集が必要な場合は、修正してほしい点を記入してください。",
        schema: { type: "string", maxLength: 2000 },
        required: false,
      },
    },
    content: [
      {
        type: "text",
        text: input.message,
      },
    ],
  };
}

function decisionFromResponse(
  response: ApprovalInputResponse,
): Exclude<TransitionDecision, "expire" | "execute"> {
  if (response.approval === "approve") {
    return "approve";
  }
  if (response.approval === "edit") {
    return "edit";
  }
  return "reject";
}

async function countPriorEditDecisions(
  repository: ApprovalStateRepository,
  request: ApprovalRequestRecord,
): Promise<number> {
  let count = 0;
  let depth = 0;
  let parentId = request.parent_id;
  while (parentId !== null && depth < 10) {
    const parent = await repository.getApprovalRequest(parentId);
    if (parent === null) {
      break;
    }
    if (parent.decision === "edit") {
      count += 1;
    }
    depth += 1;
    parentId = parent.parent_id;
  }
  return count;
}

export async function applyApprovalInputResponse(input: {
  requestState: string;
  response: ApprovalInputResponse;
  /** 認証済み呼び出し元の principal (user_id のハッシュ等)。
   *  Authenticated caller's principal (e.g. hashed user_id).
   *  Principal pemanggil yang terautentikasi.
   *  指定時は approval_requests.principal と一致しない限り拒否する。 */
  callerPrincipal?: string;
  repository?: ApprovalStateRepository;
  notificationSink?: NotificationSink;
  now?: Date;
}): Promise<ApplyApprovalResponseResult> {
  const repository = input.repository ?? new ApprovalRepository();
  const sink = input.notificationSink ?? loggingNotificationSink;
  const now = input.now ?? new Date();

  const request = await repository.getApprovalRequest(input.requestState);
  if (request === null) {
    return { ok: false, reason: "request_state_not_found" };
  }

  // Bug 2 fix: 呼び出し元 principal が承認行の principal と一致することを確認する。
  // Reject if the authenticated caller does not own this approval row.
  // Tolak jika pemanggil yang terautentikasi bukan pemilik baris persetujuan ini.
  if (input.callerPrincipal !== undefined && input.callerPrincipal !== request.principal) {
    return { ok: false, reason: "principal_mismatch" };
  }

  const draft = await repository.getDraft(request.draft_id);
  if (draft === null) {
    return { ok: false, reason: "draft_not_found" };
  }

  // Bug 1 fix: parent_id が存在するのに親行を取得できない場合はゲートを通過させない。
  // If parent_id is set but the parent row is missing, the parent gate cannot be
  // evaluated — fail closed rather than silently skip the check.
  // Jika parent_id diisi tapi baris induk tidak ada, gagalkan dengan aman.
  let parent: ApprovalRequestRecord | null = null;
  if (request.parent_id !== null) {
    parent = await repository.getApprovalRequest(request.parent_id);
    if (parent === null) {
      return { ok: false, reason: "parent_not_found" };
    }
  }

  const transitionInput = {
    currentStatus: request.status,
    decision: decisionFromResponse(input.response),
    expiresAt: new Date(request.expires_at),
    now,
    storedDraftSha256: request.draft_sha256,
    currentDraftSha256: draft.sha256,
    priorEditDecisionCount: await countPriorEditDecisions(repository, request),
  };
  const transition =
    parent === null
      ? evaluateApprovalTransition(transitionInput)
      : evaluateApprovalTransition({
          ...transitionInput,
          parent: { status: parent.status, draftSha256: parent.draft_sha256 },
        });

  if (!transition.ok) {
    if (transition.nextStatus === "rejected" || transition.nextStatus === "expired") {
      await repository.transitionPendingApproval({
        id: request.id,
        nextStatus: transition.nextStatus,
        decision: transitionInput.decision,
        now,
      });
      return { ok: false, reason: transition.reason, status: transition.nextStatus };
    }
    return { ok: false, reason: transition.reason };
  }

  if (
    transition.nextStatus !== "approved" &&
    transition.nextStatus !== "rejected" &&
    transition.nextStatus !== "escalated"
  ) {
    return { ok: false, reason: "invalid_transition_result" };
  }

  const updated = await repository.transitionPendingApproval({
    id: request.id,
    nextStatus: transition.nextStatus,
    decision: transitionInput.decision,
    now,
  });
  if (!updated.updated) {
    return { ok: false, reason: "cas_failed" };
  }

  if (transition.nextStatus === "escalated") {
    await sink.notify({
      type: "approval_escalated",
      requestState: request.id,
      reason: input.response.edit_note ?? "edit_loop_limit",
    });
  }

  return { ok: true, status: transition.nextStatus, request: updated.row };
}

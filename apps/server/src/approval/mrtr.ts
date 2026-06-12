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

function decisionFromResponse(response: ApprovalInputResponse): TransitionDecision {
  if (response.approval === "approve") {
    return "approve";
  }
  if (response.approval === "edit") {
    return "edit";
  }
  return "reject";
}

async function countParentChain(
  repository: ApprovalStateRepository,
  request: ApprovalRequestRecord,
): Promise<number> {
  let count = 0;
  let parentId = request.parent_id;
  while (parentId !== null && count < 10) {
    const parent = await repository.getApprovalRequest(parentId);
    if (parent === null) {
      break;
    }
    count += 1;
    parentId = parent.parent_id;
  }
  return count;
}

export async function applyApprovalInputResponse(input: {
  requestState: string;
  response: ApprovalInputResponse;
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

  const draft = await repository.getDraft(request.draft_id);
  if (draft === null) {
    return { ok: false, reason: "draft_not_found" };
  }

  const parent =
    request.parent_id === null ? null : await repository.getApprovalRequest(request.parent_id);
  const transitionInput = {
    currentStatus: request.status,
    decision: decisionFromResponse(input.response),
    expiresAt: new Date(request.expires_at),
    now,
    storedDraftSha256: request.draft_sha256,
    currentDraftSha256: draft.sha256,
    editLoopCount: await countParentChain(repository, request),
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

import { describe, expect, it, vi } from "vitest";
import {
  type ApprovalStateRepository,
  applyApprovalInputResponse,
  buildApprovalInputRequiredResult,
} from "../../src/approval/mrtr.js";
import type { NotificationSink } from "../../src/approval/notification-sink.js";
import type { ApprovalRequestRecord, DraftRecord } from "../../src/approval/types.js";

const NOW = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = "2026-06-13T00:00:00.000Z";
const SHA = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SHA = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function approval(input: Partial<ApprovalRequestRecord> = {}): ApprovalRequestRecord {
  return {
    id: "ars_abcdefghijklmnopqrstuv",
    draft_id: "00000000-0000-0000-0000-000000000001",
    draft_sha256: SHA,
    principal: "user-pro-1",
    step: "gyoseishoshi_approval",
    parent_id: null,
    status: "pending",
    idempotency_key: "idem-1",
    expires_at: FUTURE,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    decided_at: null,
    trace_id: null,
    ...input,
  };
}

function draft(sha256 = SHA): DraftRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    case_handle: "SAMPLE-CASE-0001",
    sha256,
    storage_uri: null,
    status: "active",
    expires_at: FUTURE,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
  };
}

function repository(input: {
  requests: ApprovalRequestRecord[];
  draft: DraftRecord;
}): ApprovalStateRepository {
  return {
    async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
      return input.requests.find((request) => request.id === id) ?? null;
    },
    async getDraft(): Promise<DraftRecord | null> {
      return input.draft;
    },
    async transitionPendingApproval(
      args,
    ): Promise<{ updated: true; row: ApprovalRequestRecord } | { updated: false }> {
      const row = input.requests.find((request) => request.id === args.id);
      if (
        row === undefined ||
        row.status !== "pending" ||
        row.expires_at <= args.now.toISOString()
      ) {
        return { updated: false };
      }
      row.status = args.nextStatus;
      row.decided_at = args.now.toISOString();
      return { updated: true, row };
    },
  };
}

describe("approval MRTR helpers", () => {
  it("builds an InputRequiredResult with an opaque requestState", () => {
    const result = buildApprovalInputRequiredResult({
      requestState: "ars_abcdefghijklmnopqrstuv",
      message: "承認してください",
    });
    expect(result.resultType).toBe("inputRequired");
    expect(result.requestState).toBe("ars_abcdefghijklmnopqrstuv");
    expect(result.inputRequests.approval.schema.enum).toEqual(["approve", "edit", "reject"]);
  });

  it("approves a pending request through CAS", async () => {
    const request = approval();
    const result = await applyApprovalInputResponse({
      requestState: request.id,
      response: { approval: "approve" },
      repository: repository({ requests: [request], draft: draft() }),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("approved");
      expect(result.request.decided_at).toBe(NOW.toISOString());
    }
  });

  it("rejects TOCTOU hash mismatches", async () => {
    const request = approval();
    const result = await applyApprovalInputResponse({
      requestState: request.id,
      response: { approval: "approve" },
      repository: repository({ requests: [request], draft: draft(OTHER_SHA) }),
      now: NOW,
    });

    expect(result).toEqual({
      ok: false,
      reason: "draft_hash_mismatch",
      status: "rejected",
    });
  });

  it("escalates after three parent approval loops", async () => {
    const root = approval({ id: "ars_rootabcdefghijklmnopqr", status: "rejected" });
    const second = approval({
      id: "ars_secondabcdefghijklmnop",
      parent_id: root.id,
      status: "rejected",
    });
    const third = approval({
      id: "ars_thirdabcdefghijklmnopq",
      parent_id: second.id,
      status: "rejected",
    });
    const current = approval({ parent_id: third.id });
    const sink: NotificationSink = { notify: vi.fn(async () => undefined) };

    const result = await applyApprovalInputResponse({
      requestState: current.id,
      response: { approval: "edit", edit_note: "修正してください" },
      repository: repository({ requests: [root, second, third, current], draft: draft() }),
      notificationSink: sink,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("escalated");
    }
    expect(sink.notify).toHaveBeenCalledOnce();
  });
});

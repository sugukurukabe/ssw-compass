import { describe, expect, it } from "vitest";
import { evaluateApprovalTransition } from "../../src/approval/state-machine.js";

const NOW = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = new Date("2026-06-13T00:00:00.000Z");
const PAST = new Date("2026-06-11T00:00:00.000Z");
const SHA = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SHA = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("evaluateApprovalTransition", () => {
  it("approves a pending request when hashes match", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "approve",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
      }),
    ).toEqual({ ok: true, nextStatus: "approved" });
  });

  it("rejects TOCTOU hash mismatch and requests a new approval cycle", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "approve",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: OTHER_SHA,
      }),
    ).toEqual({ ok: false, reason: "draft_hash_mismatch", nextStatus: "rejected" });
  });

  it("treats an expired pending request as expired before approval", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "approve",
        expiresAt: PAST,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
      }),
    ).toEqual({ ok: false, reason: "expired", nextStatus: "expired" });
  });

  it("blocks replay after a terminal decision", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "rejected",
        decision: "approve",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
      }),
    ).toEqual({ ok: false, reason: "already_decided" });
  });

  it("moves edit requests to rejected until the loop limit is reached", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "edit",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
        editLoopCount: 2,
      }),
    ).toEqual({ ok: true, nextStatus: "rejected" });
  });

  it("escalates edit requests after three loops", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "edit",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
        editLoopCount: 3,
      }),
    ).toEqual({ ok: true, nextStatus: "escalated" });
  });

  it("requires an approved parent with matching draft hash", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "pending",
        decision: "approve",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
        parent: { status: "pending", draftSha256: SHA },
      }),
    ).toEqual({ ok: false, reason: "parent_not_approved" });
  });

  it("executes only from approved state", () => {
    expect(
      evaluateApprovalTransition({
        currentStatus: "approved",
        decision: "execute",
        expiresAt: FUTURE,
        now: NOW,
        storedDraftSha256: SHA,
        currentDraftSha256: SHA,
      }),
    ).toEqual({ ok: true, nextStatus: "executed" });
  });
});

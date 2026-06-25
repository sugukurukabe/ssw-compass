/**
 * submit_gyoseishoshi_approval MRTR 回帰テスト (ADR-024 / 多段承認の後方互換固定)
 * MRTR regression tests — lock the requestState branch and RC backward-compat.
 * Tes regresi MRTR — mengunci cabang requestState dan kompatibilitas mundur RC.
 *
 * applyApprovalInputResponse は Supabase に到達するため module mock で隔離する。
 * これによりハンドラの「MRTR 経路 / 従来経路」の分岐挙動だけを検証できる。
 */

import type { AuthContextType } from "@ssw/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

const { applyApprovalInputResponseMock } = vi.hoisted(() => ({
  applyApprovalInputResponseMock: vi.fn(),
}));

vi.mock("../../../src/approval/index.js", () => ({
  applyApprovalInputResponse: applyApprovalInputResponseMock,
}));

import * as writer from "../../../src/audit/writer.js";
import { _submitGyoseishoshiApprovalInner } from "../../../src/tools/submit-gyoseishoshi-approval/handler.js";

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

const BASE_INPUT = {
  case_id: "case_abcd1234efgh5678",
  draft_document_id: "doc_abcd1234efgh5678",
  draft_content_hash: `sha256:${"a".repeat(64)}`,
  approval_method: "checkbox_only" as const,
  approver_gyoseishoshi_number: "東京都 12345",
  language: "ja" as const,
};

const REQUEST_STATE = "ars_abcdefghijklmnopqrstuv";

afterEach(() => {
  applyApprovalInputResponseMock.mockReset();
  vi.restoreAllMocks();
});

describe("submit_gyoseishoshi_approval — MRTR requestState path (regression)", () => {
  it("approve response → finalized (approved=true, status=approved), audit recorded, identifier returned", async () => {
    applyApprovalInputResponseMock.mockResolvedValue({
      ok: true,
      status: "approved",
      request: { id: REQUEST_STATE },
    });
    const spy = vi.spyOn(writer, "emitAuditEvent");

    const result = await _submitGyoseishoshiApprovalInner(
      { ...BASE_INPUT, requestState: REQUEST_STATE, inputResponses: { approval: "approve" } },
      PRO_GYO,
    );

    const sc = result.structuredContent as Record<string, unknown>;
    expect(result.isError).toBeFalsy();
    expect(sc["approved"]).toBe(true);
    expect(sc["status"]).toBe("approved");
    // 承認記録の識別子 (requestState) が structuredContent で返る。
    expect(sc["requestState"]).toBe(REQUEST_STATE);
    expect(sc["audit_event_recorded"]).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    const [event] = spy.mock.calls[0] as [Parameters<typeof writer.emitAuditEvent>[0]];
    expect(event.action).toBe("draft_approved");
    expect(event.legal_level).toBe("L2");
  });

  it("non-approving outcome before finalization (status not approved) → approved=false", async () => {
    // 承認応答が approved に至らない (pending/escalated 相当) 間は確定しない。
    applyApprovalInputResponseMock.mockResolvedValue({
      ok: true,
      status: "escalated",
      request: { id: REQUEST_STATE },
    });

    const result = await _submitGyoseishoshiApprovalInner(
      { ...BASE_INPUT, requestState: REQUEST_STATE, inputResponses: { approval: "edit" } },
      PRO_GYO,
    );

    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc["approved"]).toBe(false);
    expect(sc["status"]).toBe("escalated");
  });

  it("failed transition (ok=false) → isError, approved=false, but audit event still recorded", async () => {
    applyApprovalInputResponseMock.mockResolvedValue({
      ok: false,
      reason: "draft_hash_mismatch",
      status: "rejected",
    });
    const spy = vi.spyOn(writer, "emitAuditEvent");

    const result = await _submitGyoseishoshiApprovalInner(
      { ...BASE_INPUT, requestState: REQUEST_STATE, inputResponses: { approval: "approve" } },
      PRO_GYO,
    );

    const sc = result.structuredContent as Record<string, unknown>;
    expect(result.isError).toBe(true);
    expect(sc["approved"]).toBe(false);
    expect(sc["reason"]).toBe("draft_hash_mismatch");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("requestState present but inputResponses missing → isError, MRTR not invoked", async () => {
    const result = await _submitGyoseishoshiApprovalInner(
      { ...BASE_INPUT, requestState: REQUEST_STATE },
      PRO_GYO,
    );
    expect(result.isError).toBe(true);
    expect(applyApprovalInputResponseMock).not.toHaveBeenCalled();
  });
});

describe("submit_gyoseishoshi_approval — RC backward-compat (legacy, no requestState)", () => {
  it("legacy call works as before and never touches the MRTR approval path", async () => {
    const result = await _submitGyoseishoshiApprovalInner(BASE_INPUT, PRO_GYO);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(result.isError).toBeFalsy();
    expect(sc["approved"]).toBe(true);
    expect(sc["approver_gyoseishoshi_number"]).toBe(BASE_INPUT.approver_gyoseishoshi_number);
    expect(sc["audit_event_recorded"]).toBe(true);
    expect(applyApprovalInputResponseMock).not.toHaveBeenCalled();
  });
});

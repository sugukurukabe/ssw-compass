/**
 * submit_gyoseishoshi_approval tests (ADR-014 L2 / ADR-015 H04 / sprint-4-plan §4 B.5)
 */

import { type AuthContextType, DISCLAIMER_BY_LANG } from "@ssw/shared-types";
import { describe, expect, it, vi } from "vitest";
import * as writer from "../../../src/audit/writer.js";
import { HitlGateError } from "../../../src/hitl/lockgate.js";
import {
  _submitGyoseishoshiApprovalInner,
  submitGyoseishoshiApprovalHandler,
} from "../../../src/tools/submit-gyoseishoshi-approval/handler.js";

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

const FREE_AUTH: AuthContextType = {
  user_id: "anon",
  tier: "free",
  gyoseishoshi_verified: false,
  auth_source: "anonymous",
  issued_at: 0,
};

const BASE_INPUT = {
  case_id: "case_abcd1234efgh5678",
  draft_document_id: "doc_abcd1234efgh5678",
  draft_content_hash: `sha256:${"a".repeat(64)}`,
  approval_method: "checkbox_only" as const,
  approver_gyoseishoshi_number: "東京都 12345",
  language: "ja" as const,
};

describe("submit_gyoseishoshi_approval — auth", () => {
  it("Free tier → HitlGateError (L2 static)", async () => {
    await expect(_submitGyoseishoshiApprovalInner(BASE_INPUT, FREE_AUTH)).rejects.toThrow(
      HitlGateError,
    );
  });

  it("null auth → HitlGateError", async () => {
    await expect(_submitGyoseishoshiApprovalInner(BASE_INPUT, null)).rejects.toThrow(HitlGateError);
  });

  it("Pro + gyoseishoshi → success", async () => {
    const result = await _submitGyoseishoshiApprovalInner(BASE_INPUT, PRO_GYO);
    expect(result.isError).toBeFalsy();
  });
});

describe("submit_gyoseishoshi_approval — outer wrapper error conversion", () => {
  it("converts HitlGateError to a safe isError result with the lockgate message + disclaimer", async () => {
    // 認証コンテキスト未設定 (匿名) → inner が HitlGateError を throw → outer が変換。
    const result = await submitGyoseishoshiApprovalHandler(BASE_INPUT);
    expect(result.isError).toBe(true);
    const block = result.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    expect(text).toContain("Pro 以上の行政書士アカウント");
    expect(text).toContain(DISCLAIMER_BY_LANG.ja);
  });
});

describe("submit_gyoseishoshi_approval — audit event written BEFORE return", () => {
  it("emitAuditEvent is called", async () => {
    const spy = vi.spyOn(writer, "emitAuditEvent");
    await _submitGyoseishoshiApprovalInner(BASE_INPUT, PRO_GYO);
    expect(spy).toHaveBeenCalledOnce();
    const [event] = spy.mock.calls[0] as [Parameters<typeof writer.emitAuditEvent>[0]];
    expect(event.action).toBe("draft_approved");
    expect(event.case_id).toBe("case_abcd1234efgh5678");
    expect(event.legal_level).toBe("L2");
    expect(event.schema_version).toBe("v1");
    spy.mockRestore();
  });
});

describe("submit_gyoseishoshi_approval — gate unmet has zero side effects (boundary: auth gate)", () => {
  // ゲート判定は authContext の署名 JWT クレームのみを使う。
  // args の自己申告 (approver_gyoseishoshi_number 等) は信用しない。
  it("Free tier with a self-asserted approver number → throws before any audit event", async () => {
    const spy = vi.spyOn(writer, "emitAuditEvent");
    await expect(
      _submitGyoseishoshiApprovalInner(
        { ...BASE_INPUT, approver_gyoseishoshi_number: "東京都 99999" },
        FREE_AUTH,
      ),
    ).rejects.toThrow(HitlGateError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("null (anonymous) auth → throws and emits no audit event (no side effects)", async () => {
    const spy = vi.spyOn(writer, "emitAuditEvent");
    await expect(_submitGyoseishoshiApprovalInner(BASE_INPUT, null)).rejects.toThrow(HitlGateError);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("outer wrapper anonymous → unapproved isError result, no audit event, no approved structuredContent", async () => {
    const spy = vi.spyOn(writer, "emitAuditEvent");
    const result = await submitGyoseishoshiApprovalHandler(BASE_INPUT);
    expect(result.isError).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    expect(sc?.["approved"]).not.toBe(true);
    spy.mockRestore();
  });
});

describe("submit_gyoseishoshi_approval — records only (no document generation / authority filing)", () => {
  // 記録のみ: ハンドラは承認の記録 (監査ログ) だけを行い、書類生成・当局提出・
  // ファイル書き出しのいずれも行わない。出力にもそれらを示すフィールドを返さない。
  it("legacy success returns a record acknowledgement only — no generated document or filing fields", async () => {
    const result = await _submitGyoseishoshiApprovalInner(BASE_INPUT, PRO_GYO);
    const sc = result.structuredContent as Record<string, unknown>;
    for (const forbidden of [
      "document_generated",
      "generated_document",
      "submitted_to_authority",
      "filed",
      "filing_id",
      "submission_id",
      "pdf",
      "pdf_url",
      "file_path",
      "storage_uri",
    ]) {
      expect(sc).not.toHaveProperty(forbidden);
    }
    expect(sc["audit_event_recorded"]).toBe(true);
    expect(sc["approved"]).toBe(true);
  });
});

describe("submit_gyoseishoshi_approval — input validation", () => {
  it("checkbox_with_seal without seal_image → zod rejects", async () => {
    const badInput = { ...BASE_INPUT, approval_method: "checkbox_with_seal" as const };
    await expect(_submitGyoseishoshiApprovalInner(badInput, PRO_GYO)).rejects.toThrow();
  });

  it("case_id malformed → zod rejects", async () => {
    const badInput = { ...BASE_INPUT, case_id: "CASE_UPPERCASE" };
    await expect(_submitGyoseishoshiApprovalInner(badInput, PRO_GYO)).rejects.toThrow();
  });

  it("approver_number wrong format → zod rejects", async () => {
    const badInput = { ...BASE_INPUT, approver_gyoseishoshi_number: "12345" };
    await expect(_submitGyoseishoshiApprovalInner(badInput, PRO_GYO)).rejects.toThrow();
  });

  it("response includes audit_event_recorded=true", async () => {
    const result = await _submitGyoseishoshiApprovalInner(BASE_INPUT, PRO_GYO);
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc["audit_event_recorded"]).toBe(true);
    expect(sc["approved"]).toBe(true);
  });
});

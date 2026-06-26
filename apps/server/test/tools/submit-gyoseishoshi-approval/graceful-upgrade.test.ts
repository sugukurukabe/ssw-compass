/**
 * Phase 2a: HITL ロックゲート (200 + isError) 経路での graceful upgrade explanation。
 * docs/ux/free-to-pro-experience.md §3.2 / 提案書 §6 Phase 2a。
 *
 * 検証: HITL 拒否は 200 + isError 契約を維持したまま、説明 + 外部リンク + Free 代替導線 +
 * 免責 (§19 逐語) + _meta(redirect_domains) を上乗せする。ゲートは弱めない (監査イベント
 * は発火しない = 副作用ゼロ)。
 */

import { DISCLAIMER_BY_LANG } from "@ssw/shared-types";
import { describe, expect, it, vi } from "vitest";
import * as writer from "../../../src/audit/writer.js";
import { DEFAULT_PRO_UPGRADE_URL } from "../../../src/auth/upgrade-notice.js";
import { submitGyoseishoshiApprovalHandler } from "../../../src/tools/submit-gyoseishoshi-approval/handler.js";

const BASE_INPUT = {
  case_id: "case_abcd1234efgh5678",
  draft_document_id: "doc_abcd1234efgh5678",
  draft_content_hash: `sha256:${"a".repeat(64)}`,
  approval_method: "checkbox_only" as const,
  approver_gyoseishoshi_number: "東京都 12345",
  language: "ja" as const,
};

describe("submit_gyoseishoshi_approval — HITL denial carries graceful upgrade explanation", () => {
  it("anonymous call → 200/isError contract preserved, explanation + _meta added, zero side effects", async () => {
    const spy = vi.spyOn(writer, "emitAuditEvent");
    // 認証コンテキスト未設定 (匿名) → HITL ロックゲートで拒否される。
    const result = await submitGyoseishoshiApprovalHandler(BASE_INPUT);

    // 拒否契約 (isError) は不変。HTTP ステータス変更なし (ツール結果は 200)。
    expect(result.isError).toBe(true);

    const block = result.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    // 既存のロックゲート文言を保持。
    expect(text).toContain("Pro 以上の行政書士アカウント");
    // graceful 説明 (外部リンク = 許可ドメインのみ)。
    expect(text).toContain(DEFAULT_PRO_UPGRADE_URL);
    // §19 免責が逐語で末尾に残る。
    expect(text.endsWith(DISCLAIMER_BY_LANG.ja)).toBe(true);

    // _meta に構造化説明 + redirect_domains。
    const meta = result._meta as
      | { redirect_domains?: string[]; "compass/upgrade_notice"?: { upgrade_url?: string } }
      | undefined;
    expect(meta?.redirect_domains).toEqual([new URL(DEFAULT_PRO_UPGRADE_URL).origin]);
    expect(meta?.["compass/upgrade_notice"]?.upgrade_url).toBe(DEFAULT_PRO_UPGRADE_URL);

    // 副作用ゼロ: 監査イベントは一切発火しない。
    expect(spy).not.toHaveBeenCalled();
    // approved を構造化出力に出さない (アクセス付与ではない)。
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    expect(sc?.["approved"]).not.toBe(true);
    spy.mockRestore();
  });

  it("denial response contains no internal IDs / PII tokens", async () => {
    const result = await submitGyoseishoshiApprovalHandler(BASE_INPUT);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const token of ["trace", "session", "user_id", "audit_event", "audit_id", "ip_address"]) {
      expect(serialized).not.toContain(token);
    }
  });
});

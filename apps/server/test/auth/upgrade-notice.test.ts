/**
 * Phase 2a: Graceful upgrade explanation tests (docs/ux/free-to-pro-experience.md §3.2)
 *
 * 検証する受け入れ条件 (提案書 §6 Phase 2a / §7):
 * - 未認可 Free 呼び出しで構造化説明が返る (denial 維持・副作用ゼロ)。
 * - 応答に内部 ID・PII が無い。
 * - 免責 (§19) が逐語。
 * - 決済 UI / アプリ内課金の煽り文言を含まない。
 * - 外部リンクは許可ドメインのみ (redirect_domains)。
 * - 既存の 403 / -32003 / WWW-Authenticate 契約が維持される。
 */

import {
  ANONYMOUS_AUTH_CONTEXT,
  type AuthContextType,
  DISCLAIMER_BY_LANG,
  type SupportedLanguage,
} from "@ssw/shared-types";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import {
  buildScopeDenialBody,
  buildUpgradeNotice,
  DEFAULT_PRO_UPGRADE_URL,
  proRedirectDomains,
  renderUpgradeExplanation,
} from "../../src/auth/upgrade-notice.js";
import { enforceScopes } from "../../src/index.js";

// 内部 ID / PII を疑わせる禁止トークン。応答 JSON に現れてはならない。
// (注: "監査記録"/"audit" は Pro の価値説明の文言であり ID ではないため、
//  ここでは内部 ID 形 (audit_event / audit_id 等) のみを禁止する。)
const FORBIDDEN_ID_TOKENS = [
  "trace",
  "session",
  "user_id",
  "user-id",
  "audit_event",
  "audit_id",
  "ip_address",
  "gyoseishoshi_number",
];

// 決済 UI / 煽り (ダークパターン) を疑わせる禁止トークン。
const FORBIDDEN_BILLING_TOKENS = [
  "¥",
  "$",
  "checkout",
  "credit card",
  "今すぐアップグレード",
  "残りわずか",
  "クレジットカード",
];

function makeReq(input: {
  toolName: string;
  language?: string;
  authContext?: AuthContextType;
}): Request {
  const args = input.language === undefined ? {} : { language: input.language };
  return {
    body: {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: input.toolName, arguments: args },
    },
    authContext: input.authContext ?? ANONYMOUS_AUTH_CONTEXT,
  } as unknown as Request;
}

function makeCapturingRes(): {
  res: Response;
  holder: { status?: number; headers: Record<string, string>; body?: unknown };
} {
  const holder: { status?: number; headers: Record<string, string>; body?: unknown } = {
    headers: {},
  };
  const res = {
    status: (status: number) => {
      holder.status = status;
      return res;
    },
    set: (name: string, value: string) => {
      holder.headers[name] = value;
      return res;
    },
    json: (body: unknown) => {
      holder.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, holder };
}

describe("buildUpgradeNotice — 5-element structured explanation", () => {
  it("contains all five elements (value / why / how / free / disclaimer)", () => {
    const notice = buildUpgradeNotice({
      tool: "prepare_document_package",
      lang: "ja",
      requiredScope: "compass:draft",
    });
    expect(notice.what_you_can_do.length).toBeGreaterThan(0);
    expect(notice.why_unavailable.length).toBeGreaterThan(0);
    expect(notice.how_to_unlock).toContain(DEFAULT_PRO_UPGRADE_URL);
    expect(notice.free_alternative_tools).toContain("list_visa_documents");
    expect(notice.disclaimer).toBe(DISCLAIMER_BY_LANG.ja);
  });

  it("targets gyoseishoshi only and is non-modal/once (no aggressive upsell)", () => {
    const notice = buildUpgradeNotice({ tool: "submit_gyoseishoshi_approval", lang: "ja" });
    expect(notice.audience).toBe("gyoseishoshi");
    expect(notice.presentation).toBe("non_modal_once");
  });

  it("uses DISCLAIMER_BY_LANG verbatim for every supported language", () => {
    const langs: SupportedLanguage[] = ["ja", "en", "id", "zh-CN", "vi", "my"];
    for (const lang of langs) {
      const notice = buildUpgradeNotice({ tool: "prepare_document_package", lang });
      expect(notice.disclaimer).toBe(DISCLAIMER_BY_LANG[lang]);
    }
  });

  it("localizes the explanation for ja/en/id and falls back to en for other languages", () => {
    const ja = buildUpgradeNotice({ tool: "prepare_document_package", lang: "ja" });
    const en = buildUpgradeNotice({ tool: "prepare_document_package", lang: "en" });
    const id = buildUpgradeNotice({ tool: "prepare_document_package", lang: "id" });
    const vi = buildUpgradeNotice({ tool: "prepare_document_package", lang: "vi" });
    expect(ja.what_you_can_do).not.toBe(en.what_you_can_do);
    expect(en.what_you_can_do).not.toBe(id.what_you_can_do);
    // 未対応言語の本文は en にフォールバックするが、免責は当該言語で逐語。
    expect(vi.what_you_can_do).toBe(en.what_you_can_do);
    expect(vi.disclaimer).toBe(DISCLAIMER_BY_LANG.vi);
  });

  it("declares only the external Pro origin in redirect_domains", () => {
    expect(proRedirectDomains()).toEqual([new URL(DEFAULT_PRO_UPGRADE_URL).origin]);
  });

  it("contains no internal IDs / PII and no billing UI / dark-pattern wording", () => {
    const notice = buildUpgradeNotice({
      tool: "prepare_document_package",
      lang: "ja",
      requiredScope: "compass:draft",
    });
    const serialized = JSON.stringify(notice).toLowerCase();
    for (const token of FORBIDDEN_ID_TOKENS) {
      expect(serialized).not.toContain(token.toLowerCase());
    }
    const human = `${renderUpgradeExplanation(notice)} ${JSON.stringify(notice)}`;
    for (const token of FORBIDDEN_BILLING_TOKENS) {
      expect(human).not.toContain(token);
    }
  });
});

describe("enforceScopes — 403 scope gate keeps its contract AND adds graceful explanation", () => {
  it("denies an anonymous Free caller with status 403 + -32003 + WWW-Authenticate (contract preserved)", () => {
    const { res, holder } = makeCapturingRes();
    const allowed = enforceScopes(makeReq({ toolName: "prepare_document_package" }), res);
    expect(allowed).toBe(false);
    expect(holder.status).toBe(403);
    expect(holder.headers["WWW-Authenticate"]).toContain('scope="compass:draft"');
    const body = holder.body as {
      jsonrpc: string;
      error: { code: number; message: string; data?: unknown };
      id: unknown;
    };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error.code).toBe(-32003);
    expect(body.error.message).toBe("Insufficient scope: compass:draft");
    expect(body.id).toBe(7);
  });

  it("embeds the structured upgrade explanation + redirect_domains in the denial body", () => {
    const { res, holder } = makeCapturingRes();
    enforceScopes(makeReq({ toolName: "prepare_document_package", language: "en" }), res);
    const body = holder.body as {
      error: { data?: { upgrade_notice?: { upgrade_url?: string; disclaimer?: string } } };
      _meta?: { redirect_domains?: string[]; "compass/upgrade_notice"?: unknown };
    };
    const notice = body.error.data?.upgrade_notice;
    expect(notice?.upgrade_url).toBe(DEFAULT_PRO_UPGRADE_URL);
    expect(notice?.disclaimer).toBe(DISCLAIMER_BY_LANG.en);
    expect(body._meta?.redirect_domains).toEqual([new URL(DEFAULT_PRO_UPGRADE_URL).origin]);
    expect(body._meta?.["compass/upgrade_notice"]).toBeDefined();
  });

  it("denial body carries no internal IDs / PII tokens", () => {
    const { res, holder } = makeCapturingRes();
    enforceScopes(
      makeReq({
        toolName: "submit_gyoseishoshi_approval",
        authContext: {
          user_id: "pro-no-verify",
          tier: "pro",
          gyoseishoshi_verified: false,
          auth_source: "jwt",
          issued_at: 1,
        },
      }),
      res,
    );
    expect(holder.status).toBe(403);
    const serialized = JSON.stringify(holder.body).toLowerCase();
    // 自己申告/認証コンテキストの内部 ID が応答へ漏れないこと。
    expect(serialized).not.toContain("pro-no-verify");
    for (const token of FORBIDDEN_ID_TOKENS) {
      expect(serialized).not.toContain(token.toLowerCase());
    }
  });

  it("still allows anonymous read-only tools unchanged", () => {
    const { res } = makeCapturingRes();
    expect(enforceScopes(makeReq({ toolName: "search_visa" }), res)).toBe(true);
  });
});

describe("buildScopeDenialBody — unit", () => {
  it("preserves -32003 message and id while adding data + _meta", () => {
    const body = buildScopeDenialBody({
      tool: "get_package_status",
      requiredScope: "compass:draft",
      id: 42,
      lang: "ja",
    });
    expect(body["jsonrpc"]).toBe("2.0");
    expect((body["error"] as { code: number }).code).toBe(-32003);
    expect((body["error"] as { message: string }).message).toBe(
      "Insufficient scope: compass:draft",
    );
    expect(body["id"]).toBe(42);
    expect((body["_meta"] as { redirect_domains: string[] }).redirect_domains).toEqual([
      new URL(DEFAULT_PRO_UPGRADE_URL).origin,
    ]);
  });

  it("defaults a missing id to null (JSON-RPC contract)", () => {
    const body = buildScopeDenialBody({
      tool: "prepare_document_package",
      requiredScope: "compass:draft",
      id: undefined,
      lang: "ja",
    });
    expect(body["id"]).toBeNull();
  });
});

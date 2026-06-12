import { ANONYMOUS_AUTH_CONTEXT, type AuthContextType } from "@ssw/shared-types";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { enforceScopes } from "../../src/index.js";

function makeReq(input: { toolName: string; authContext?: AuthContextType }): Request {
  return {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: input.toolName } },
    authContext: input.authContext ?? ANONYMOUS_AUTH_CONTEXT,
  } as unknown as Request;
}

function makeRes(): {
  res: Response;
  holder: { status?: number; headers: Record<string, string> };
} {
  const holder: { status?: number; headers: Record<string, string> } = { headers: {} };
  const res = {
    status: (status: number) => {
      holder.status = status;
      return res;
    },
    set: (name: string, value: string) => {
      holder.headers[name] = value;
      return res;
    },
    json: () => res,
  } as unknown as Response;
  return { res, holder };
}

describe("OAuth scope step-up compatibility", () => {
  it("allows anonymous read-only tools", () => {
    const { res } = makeRes();
    expect(enforceScopes(makeReq({ toolName: "search_visa" }), res)).toBe(true);
  });

  it("requires compass:draft for package generation", () => {
    const { res, holder } = makeRes();
    expect(enforceScopes(makeReq({ toolName: "prepare_document_package" }), res)).toBe(false);
    expect(holder.status).toBe(403);
    expect(holder.headers["WWW-Authenticate"]).toContain('scope="compass:draft"');
  });

  it("allows verified pro approval scope", () => {
    const { res } = makeRes();
    expect(
      enforceScopes(
        makeReq({
          toolName: "submit_gyoseishoshi_approval",
          authContext: {
            user_id: "user-pro",
            tier: "pro",
            gyoseishoshi_verified: true,
            gyoseishoshi_number: "東京都 12345",
            auth_source: "jwt",
            issued_at: 1,
          },
        }),
        res,
      ),
    ).toBe(true);
  });
});

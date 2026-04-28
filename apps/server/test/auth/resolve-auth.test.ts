/**
 * resolveAuth middleware tests (ADR-013)
 * - No token → anonymous Free, next() called
 * - Valid JWT → AuthContext attached, next() called
 * - Invalid JWT → 401, next() NOT called
 */

import type { AuthContextType } from "@ssw/shared-types";
import { ANONYMOUS_AUTH_CONTEXT } from "@ssw/shared-types";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { type AuthedRequest, resolveAuth } from "../../src/auth/resolve-auth.js";
import { __setTokenVerifierForTesting } from "../../src/auth/token-verifier.js";

const PRO_CONTEXT: AuthContextType = {
  user_id: "user-pro-1",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000000,
};

function makeReq(authHeader?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === "authorization" ? authHeader : undefined),
    authContext: undefined,
  } as unknown as AuthedRequest;
}

function makeRes(): { res: Response; holder: { status: number | undefined; body: unknown } } {
  const holder: { status: number | undefined; body: unknown } = {
    status: undefined,
    body: undefined,
  };
  const res = {
    status: (s: number) => {
      holder.status = s;
      return res;
    },
    json: (b: unknown) => {
      holder.body = b;
      return res;
    },
    headersSent: false,
  } as unknown as Response;
  return { res, holder };
}

describe("resolveAuth middleware", () => {
  it("no Authorization header → anonymous Free, next() called", async () => {
    __setTokenVerifierForTesting({ verify: async () => ANONYMOUS_AUTH_CONTEXT });
    const req = makeReq();
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;
    await resolveAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect((req as AuthedRequest).authContext).toEqual(ANONYMOUS_AUTH_CONTEXT);
  });

  it("valid Bearer token → Pro AuthContext attached, next() called", async () => {
    __setTokenVerifierForTesting({ verify: async (_t) => PRO_CONTEXT });
    const req = makeReq("Bearer valid.pro.token");
    const { res } = makeRes();
    const next = vi.fn() as NextFunction;
    await resolveAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.authContext?.tier).toBe("pro");
    expect(req.authContext?.gyoseishoshi_verified).toBe(true);
  });

  it("invalid Bearer token → 401, next() NOT called", async () => {
    __setTokenVerifierForTesting({ verify: async () => null });
    const req = makeReq("Bearer bad.token.here");
    const { res, holder } = makeRes();
    const next = vi.fn() as NextFunction;
    await resolveAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(holder.status).toBe(401);
  });

  it("verifier throws → 500, next() NOT called", async () => {
    __setTokenVerifierForTesting({
      verify: async () => {
        throw new Error("secret manager unavailable");
      },
    });
    const req = makeReq("Bearer some.token");
    const { res, holder } = makeRes();
    const next = vi.fn() as NextFunction;
    await resolveAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(holder.status).toBe(500);
  });
});

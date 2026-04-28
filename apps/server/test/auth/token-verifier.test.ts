/**
 * JWT token verifier tests (ADR-013 Path Y)
 * JwtTokenVerifier の HS256 検証、tier デコード、期限切れ判定を網羅する。
 */

import { createHmac } from "node:crypto";
import { ANONYMOUS_AUTH_CONTEXT } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { extractBearerToken, JwtTokenVerifier } from "../../src/auth/token-verifier.js";

const TEST_SECRET = "test-secret-32-bytes-or-more-for-hs256";

function base64UrlEncode(s: string): string {
  return Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function makeJwt(
  claims: Record<string, unknown>,
  secret = TEST_SECRET,
  algorithm = "HS256",
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: algorithm, typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${header}.${payload}.${sig}`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const futureExp = () => nowSeconds() + 3600;
const pastExp = () => nowSeconds() - 1;

describe("JwtTokenVerifier.verify", () => {
  const verifier = new JwtTokenVerifier(TEST_SECRET);

  it("null token → anonymous Free AuthContext (not null)", async () => {
    const ctx = await verifier.verify(null);
    expect(ctx).toEqual(ANONYMOUS_AUTH_CONTEXT);
    expect(ctx?.tier).toBe("free");
  });

  it("empty string token → anonymous Free AuthContext", async () => {
    const ctx = await verifier.verify("");
    expect(ctx).toEqual(ANONYMOUS_AUTH_CONTEXT);
  });

  it("valid Pro JWT → correct AuthContext", async () => {
    const token = makeJwt({
      sub: "user-pro-1",
      tier: "pro",
      gyoseishoshi_verified: true,
      gyoseishoshi_number: "東京都 12345",
      auth_source: "jwt",
      iat: nowSeconds(),
      exp: futureExp(),
    });
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
    expect(ctx?.user_id).toBe("user-pro-1");
    expect(ctx?.tier).toBe("pro");
    expect(ctx?.gyoseishoshi_verified).toBe(true);
    expect(ctx?.gyoseishoshi_number).toBe("東京都 12345");
    expect(ctx?.auth_source).toBe("jwt");
  });

  it("valid Business JWT → correct tier", async () => {
    const token = makeJwt({
      sub: "org-biz-1",
      tier: "business",
      gyoseishoshi_verified: false,
      auth_source: "oauth_client_credentials",
      iat: nowSeconds(),
      exp: futureExp(),
    });
    const ctx = await verifier.verify(token);
    expect(ctx?.tier).toBe("business");
    expect(ctx?.auth_source).toBe("oauth_client_credentials");
  });

  it("expired token → null (caller should 401)", async () => {
    const token = makeJwt({
      sub: "user-1",
      tier: "free",
      gyoseishoshi_verified: false,
      auth_source: "jwt",
      iat: nowSeconds() - 7200,
      exp: pastExp(),
    });
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  it("wrong signature → null", async () => {
    const token = makeJwt(
      {
        sub: "user-1",
        tier: "free",
        gyoseishoshi_verified: false,
        auth_source: "jwt",
        iat: nowSeconds(),
        exp: futureExp(),
      },
      "wrong-secret",
    );
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  it("wrong algorithm (RS256) → null", async () => {
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        sub: "u",
        tier: "free",
        gyoseishoshi_verified: false,
        auth_source: "jwt",
        iat: nowSeconds(),
        exp: futureExp(),
      }),
    );
    const sig = createHmac("sha256", TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const ctx = await verifier.verify(`${header}.${payload}.${sig}`);
    expect(ctx).toBeNull();
  });

  it("malformed JWT (2 parts) → null", async () => {
    const ctx = await verifier.verify("header.payload");
    expect(ctx).toBeNull();
  });

  it("invalid tier value → null", async () => {
    const token = makeJwt({
      sub: "user-1",
      tier: "superadmin", // not in enum
      gyoseishoshi_verified: false,
      auth_source: "jwt",
      iat: nowSeconds(),
      exp: futureExp(),
    });
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });
});

describe("extractBearerToken", () => {
  it("Bearer header → token string", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("case-insensitive BEARER prefix", () => {
    expect(extractBearerToken("BEARER token123")).toBe("token123");
  });

  it("undefined header → null", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("non-Bearer auth scheme → null", () => {
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
  });
});

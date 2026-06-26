/**
 * JWT token verifier tests (ADR-013 Path Y)
 * JwtTokenVerifier の HS256 検証、tier デコード、期限切れ判定を網羅する。
 */

import { createHmac } from "node:crypto";
import { ANONYMOUS_AUTH_CONTEXT } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { buildJwtClaims, parseIssueJwtArgs, signHs256Jwt } from "../../../../scripts/issue-jwt.js";
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

  // クライアント申告非信用: 署名されたクレームだけを信用する。
  // Client self-claims are not trusted: only the signed claims are honored.
  // Klaim mandiri klien tidak dipercaya: hanya klaim bertanda tangan yang dihormati.
  it("tampered payload (self-claimed gyoseishoshi_verified/tier) with original signature → null", async () => {
    // 正規の Free トークンを発行し、ペイロードだけを権限昇格させて元の署名を流用する。
    const honest = makeJwt({
      sub: "user-free",
      tier: "free",
      gyoseishoshi_verified: false,
      auth_source: "jwt",
      iat: nowSeconds(),
      exp: futureExp(),
    });
    const [header, , sig] = honest.split(".") as [string, string, string];
    const forgedPayload = base64UrlEncode(
      JSON.stringify({
        sub: "user-free",
        tier: "business",
        gyoseishoshi_verified: true,
        gyoseishoshi_number: "東京都 99999",
        auth_source: "jwt",
        iat: nowSeconds(),
        exp: futureExp(),
      }),
    );
    const ctx = await verifier.verify(`${header}.${forgedPayload}.${sig}`);
    expect(ctx).toBeNull();
  });

  it("alg=none downgrade attack with escalated claims → null", async () => {
    const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = base64UrlEncode(
      JSON.stringify({
        sub: "attacker",
        tier: "business",
        gyoseishoshi_verified: true,
        gyoseishoshi_number: "東京都 00000",
        auth_source: "jwt",
        iat: nowSeconds(),
        exp: futureExp(),
      }),
    );
    const ctx = await verifier.verify(`${header}.${payload}.`);
    expect(ctx).toBeNull();
  });
});

// iss/aud 検証 (opt-in / 後方互換) — T11 Pro/JWT 認可ハードニング
// iss/aud verification (opt-in / backward compatible) — T11 hardening
// Verifikasi iss/aud (opt-in / kompatibel mundur) — pengerasan T11
describe("JwtTokenVerifier iss/aud verification (opt-in)", () => {
  const EXPECTED_ISS = "https://auth.ssw-compass.example/issuer";
  const EXPECTED_AUD = "https://mcp.ssw-compass.example/mcp";

  function makeBaseClaims(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      sub: "user-pro-1",
      tier: "pro",
      gyoseishoshi_verified: true,
      auth_source: "jwt",
      iat: nowSeconds(),
      exp: futureExp(),
      ...extra,
    };
  }

  // 後方互換の中核: env 未設定 (= options 未指定) なら iss/aud 無しトークンが従来どおり通る。
  // Core backward-compat: with no expectations, a token without iss/aud verifies as before.
  it("env unset → token WITHOUT iss/aud verifies (backward compatible)", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET);
    const token = makeJwt(makeBaseClaims({}));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
    expect(ctx?.tier).toBe("pro");
  });

  // 空文字の期待値は「未設定」と同義 (検証スキップ)。
  it("empty-string expectations → treated as unset (no iss/aud enforcement)", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, {
      expectedIssuer: "",
      expectedAudience: "",
    });
    const token = makeJwt(makeBaseClaims({}));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
  });

  it("expected aud set → matching aud (string) verifies", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const token = makeJwt(makeBaseClaims({ aud: EXPECTED_AUD }));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
    expect(ctx?.user_id).toBe("user-pro-1");
  });

  it("expected aud set → matching aud (array membership) verifies", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const token = makeJwt(makeBaseClaims({ aud: ["other-rs", EXPECTED_AUD] }));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
  });

  // 不正 aud 拒否。
  it("expected aud set → wrong aud → null (rejected)", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const token = makeJwt(makeBaseClaims({ aud: "https://evil.example/mcp" }));
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  // 他サーバー向けトークン (aud 配列に期待値が無い) を拒否。
  it("expected aud set → token aimed at another resource server → null", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const token = makeJwt(makeBaseClaims({ aud: ["https://other-rs.example/api"] }));
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  // 期待 aud 設定下で aud クレーム欠落のトークンを拒否 (strict mode)。
  it("expected aud set → token missing aud claim → null", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const token = makeJwt(makeBaseClaims({}));
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  it("expected iss set → matching iss verifies", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedIssuer: EXPECTED_ISS });
    const token = makeJwt(makeBaseClaims({ iss: EXPECTED_ISS }));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
  });

  it("expected iss set → wrong iss → null (rejected)", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedIssuer: EXPECTED_ISS });
    const token = makeJwt(makeBaseClaims({ iss: "https://evil.example/issuer" }));
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  it("expected iss set → token missing iss claim → null", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedIssuer: EXPECTED_ISS });
    const token = makeJwt(makeBaseClaims({}));
    const ctx = await verifier.verify(token);
    expect(ctx).toBeNull();
  });

  it("both iss and aud expected → both matching verifies", async () => {
    const verifier = new JwtTokenVerifier(TEST_SECRET, {
      expectedIssuer: EXPECTED_ISS,
      expectedAudience: EXPECTED_AUD,
    });
    const token = makeJwt(makeBaseClaims({ iss: EXPECTED_ISS, aud: EXPECTED_AUD }));
    const ctx = await verifier.verify(token);
    expect(ctx).not.toBeNull();
  });

  // 改ざん署名 (forged aud) は iss/aud 設定の有無に関係なく署名検証で先に落ちる。
  it("tampered aud with original signature → null even with expectations set", async () => {
    const honest = makeJwt(makeBaseClaims({ aud: EXPECTED_AUD }));
    const [header, , sig] = honest.split(".") as [string, string, string];
    const forgedPayload = base64UrlEncode(
      JSON.stringify(makeBaseClaims({ aud: "https://evil.example/mcp" })),
    );
    const verifier = new JwtTokenVerifier(TEST_SECRET, { expectedAudience: EXPECTED_AUD });
    const ctx = await verifier.verify(`${header}.${forgedPayload}.${sig}`);
    expect(ctx).toBeNull();
  });

  // issue-jwt.ts の --iss/--aud で発行したトークンが期待値検証を通過する (移行パス)。
  it("issue-jwt --iss/--aud token verifies under matching expectations", async () => {
    const options = parseIssueJwtArgs([
      "--sub",
      "jvag-gateway",
      "--tier",
      "pro",
      "--iss",
      EXPECTED_ISS,
      "--aud",
      EXPECTED_AUD,
    ]);
    const token = signHs256Jwt(buildJwtClaims(options, nowSeconds()), TEST_SECRET);
    const verifier = new JwtTokenVerifier(TEST_SECRET, {
      expectedIssuer: EXPECTED_ISS,
      expectedAudience: EXPECTED_AUD,
    });
    const ctx = await verifier.verify(token);
    expect(ctx?.user_id).toBe("jvag-gateway");
    expect(ctx?.tier).toBe("pro");
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

describe("scripts/issue-jwt integration", () => {
  it("issued Pro JWT verifies through JwtTokenVerifier", async () => {
    const options = parseIssueJwtArgs([
      "--sub",
      "jvag-gateway",
      "--tier",
      "pro",
      "--gyoseishoshi-verified",
      "--gyoseishoshi-number",
      "東京都 12345",
      "--expires",
      "90d",
    ]);
    const claims = buildJwtClaims(options, nowSeconds());
    const token = signHs256Jwt(claims, TEST_SECRET);

    const ctx = await new JwtTokenVerifier(TEST_SECRET).verify(token);

    expect(ctx).toEqual({
      user_id: "jvag-gateway",
      tier: "pro",
      gyoseishoshi_verified: true,
      gyoseishoshi_number: "東京都 12345",
      auth_source: "jwt",
      issued_at: claims.iat,
    });
  });

  // 既定 (--iss/--aud 未指定) では iss/aud は claims に付与されない (後方互換)。
  it("omits iss/aud by default (backward compatible)", () => {
    const options = parseIssueJwtArgs(["--sub", "u", "--tier", "pro"]);
    const claims = buildJwtClaims(options, nowSeconds());
    expect(claims.iss).toBeUndefined();
    expect(claims.aud).toBeUndefined();
  });

  it("includes iss/aud when --iss/--aud are provided", () => {
    const options = parseIssueJwtArgs([
      "--sub",
      "u",
      "--iss",
      "https://issuer.example",
      "--aud",
      "https://rs.example/mcp",
    ]);
    const claims = buildJwtClaims(options, nowSeconds());
    expect(claims.iss).toBe("https://issuer.example");
    expect(claims.aud).toBe("https://rs.example/mcp");
  });
});

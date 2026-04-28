/**
 * SSW Compass JWT 検証モジュール (ADR-013 Path Y)
 * JWT verification module — application-layer HS256 self-verify
 * Modul verifikasi JWT — verifikasi mandiri HS256 lapisan aplikasi
 *
 * Interface Freeze (ADR-013): SswCompassTokenVerifier.verify() signature は Sprint 4 不変。
 * Interface Freeze (ADR-013): SswCompassTokenVerifier.verify() signature is immutable for Sprint 4.
 * Pembekuan antarmuka (ADR-013): Tanda tangan SswCompassTokenVerifier.verify() tidak berubah di Sprint 4.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ANONYMOUS_AUTH_CONTEXT, type AuthContextType as AuthContext } from "@ssw/shared-types";
import { logger } from "../logger.js";

/**
 * JWT 検証インターフェース
 * JWT verification interface
 * Antarmuka verifikasi JWT
 *
 * Interface Freeze (Sprint 4): この interface は変更不可。
 * - null token input → anonymous Free AuthContext (not a 401)
 * - null return → token present but invalid → caller issues 401
 * - AuthContext return → valid token or anonymous
 */
export interface SswCompassTokenVerifier {
  verify(token: string | null): Promise<AuthContext | null>;
}

interface JwtHeader {
  alg: string;
  typ: string;
}

interface JwtClaims {
  sub: string;
  tier: string;
  gyoseishoshi_verified: boolean;
  gyoseishoshi_number?: string;
  auth_source: string;
  iat: number;
  exp: number;
}

function base64UrlDecode(s: string): string {
  const pad = s.length % 4;
  const padded = pad ? s + "=".repeat(4 - pad) : s;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function verifyHs256Signature(
  header: string,
  payload: string,
  secret: Buffer,
  sig: string,
): boolean {
  const mac = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  const pad = sig.length % 4;
  const padded = pad ? sig + "=".repeat(4 - pad) : sig;
  const provided = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (mac.length !== provided.length) return false;
  return timingSafeEqual(mac, provided);
}

export class JwtTokenVerifier implements SswCompassTokenVerifier {
  private readonly secret: Buffer;

  constructor(secret: string) {
    this.secret = Buffer.from(secret, "utf8");
  }

  async verify(token: string | null): Promise<AuthContext | null> {
    if (token === null || token.trim() === "") {
      return ANONYMOUS_AUTH_CONTEXT;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      logger.warn({ event: "jwt_rejected", reason: "malformed_parts" }, "jwt_rejected");
      return null;
    }

    const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

    let header: JwtHeader;
    let claims: JwtClaims;
    try {
      header = JSON.parse(base64UrlDecode(headerB64)) as JwtHeader;
      claims = JSON.parse(base64UrlDecode(payloadB64)) as JwtClaims;
    } catch {
      logger.warn({ event: "jwt_rejected", reason: "parse_error" }, "jwt_rejected");
      return null;
    }

    if (header.alg !== "HS256") {
      logger.warn(
        { event: "jwt_rejected", reason: "wrong_algorithm", alg: header.alg },
        "jwt_rejected",
      );
      return null;
    }

    if (!verifyHs256Signature(headerB64, payloadB64, this.secret, sigB64)) {
      logger.warn({ event: "jwt_rejected", reason: "invalid_signature" }, "jwt_rejected");
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (claims.exp < nowSeconds) {
      logger.warn({ event: "jwt_rejected", reason: "expired", exp: claims.exp }, "jwt_rejected");
      return null;
    }

    const tierResult = ["free", "pro", "business"].includes(claims.tier)
      ? (claims.tier as "free" | "pro" | "business")
      : null;
    if (tierResult === null) {
      logger.warn(
        { event: "jwt_rejected", reason: "invalid_tier", tier: claims.tier },
        "jwt_rejected",
      );
      return null;
    }

    const authSourceResult = ["anonymous", "jwt", "oauth_client_credentials"].includes(
      claims.auth_source,
    )
      ? (claims.auth_source as "anonymous" | "jwt" | "oauth_client_credentials")
      : ("jwt" as const);

    return {
      user_id: claims.sub,
      tier: tierResult,
      gyoseishoshi_verified: claims.gyoseishoshi_verified === true,
      gyoseishoshi_number: claims.gyoseishoshi_number,
      auth_source: authSourceResult,
      issued_at: claims.iat,
    };
  }
}

/**
 * リクエスト Authorization header から Bearer token を抽出
 * Extract Bearer token from request Authorization header
 * Ekstrak token Bearer dari header Authorization permintaan
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (authHeader === undefined) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match?.[1]?.trim() ?? null;
}

/** テスト用 seam — production code は呼ばない */
let _verifierOverride: SswCompassTokenVerifier | null = null;
export function __setTokenVerifierForTesting(v: SswCompassTokenVerifier | null): void {
  _verifierOverride = v;
}

function resolveJwtSecret(): string {
  const secret = process.env["SSW_JWT_SECRET"];
  if (secret === undefined || secret.length === 0) {
    throw new Error(
      "SSW_JWT_SECRET env var is required. " +
        "Set it from Secret Manager or use SSW_AUTH_MODE=anonymous for local dev.",
    );
  }
  return secret;
}

let _verifier: SswCompassTokenVerifier | null = null;

export function getTokenVerifier(): SswCompassTokenVerifier {
  if (_verifierOverride !== null) return _verifierOverride;
  if (_verifier !== null) return _verifier;
  const mode = process.env["SSW_AUTH_MODE"] ?? "jwt";
  if (mode === "anonymous") {
    _verifier = { verify: async (_token) => ANONYMOUS_AUTH_CONTEXT };
  } else {
    _verifier = new JwtTokenVerifier(resolveJwtSecret());
  }
  return _verifier;
}

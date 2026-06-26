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
  // RFC 7519 §4.1.1 / §4.1.3 — opt-in でのみ検証する登録済みクレーム。
  // Registered claims, verified only when opt-in expectations are configured.
  // Klaim terdaftar, diverifikasi hanya saat ekspektasi opt-in dikonfigurasi.
  iss?: string;
  aud?: string | string[];
}

/**
 * iss/aud 検証の期待値 (opt-in)。
 * Expected issuer/audience for opt-in iss/aud verification.
 * Penerbit/audiens yang diharapkan untuk verifikasi iss/aud opt-in.
 *
 * 後方互換: いずれも未設定なら iss/aud は検証しない (ADR-013 既定挙動を維持)。
 * Backward compatible: when both are unset, iss/aud are NOT verified.
 * Kompatibel mundur: bila keduanya kosong, iss/aud TIDAK diverifikasi.
 *
 * RFC 9728 (Protected Resource Metadata) / RFC 8707 (Resource Indicators):
 * expectedAudience はこのリソースサーバーの正規リソース識別子を表す。
 * expectedAudience represents this resource server's canonical resource identifier.
 */
export interface JwtVerifierOptions {
  expectedIssuer?: string;
  expectedAudience?: string;
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

/**
 * トークンの aud クレームが期待 audience を含むか判定する (RFC 7519 §4.1.3)。
 * Returns true when the token's aud claim contains the expected audience.
 * Mengembalikan true bila klaim aud token memuat audiens yang diharapkan.
 *
 * aud は文字列または文字列配列を許容する。配列の場合は要素一致で受理。
 * aud may be a string or an array of strings; an array matches on membership.
 */
function audienceMatches(aud: string | string[] | undefined, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

export class JwtTokenVerifier implements SswCompassTokenVerifier {
  private readonly secret: Buffer;
  private readonly expectedIssuer: string | undefined;
  private readonly expectedAudience: string | undefined;

  constructor(secret: string, options?: JwtVerifierOptions) {
    this.secret = Buffer.from(secret, "utf8");
    // 空文字は「未設定」と同義に正規化し、後方互換 (検証スキップ) を維持する。
    // Normalize empty strings to "unset" so backward-compat skip is preserved.
    // Normalkan string kosong menjadi "tidak diset" agar kompatibilitas mundur terjaga.
    this.expectedIssuer =
      options?.expectedIssuer !== undefined && options.expectedIssuer.length > 0
        ? options.expectedIssuer
        : undefined;
    this.expectedAudience =
      options?.expectedAudience !== undefined && options.expectedAudience.length > 0
        ? options.expectedAudience
        : undefined;
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

    // iss/aud 検証は opt-in (env で期待値が設定された時のみ)。
    // 未設定なら以降をスキップし、ADR-013 の既定挙動を維持する (後方互換)。
    // iss/aud verification is opt-in (only when expectations are configured).
    // When unset, the checks are skipped, preserving ADR-013 default behaviour.
    // Verifikasi iss/aud bersifat opt-in (hanya bila ekspektasi dikonfigurasi).
    if (this.expectedIssuer !== undefined && claims.iss !== this.expectedIssuer) {
      logger.warn(
        { event: "jwt_rejected", reason: "issuer_mismatch", iss: claims.iss },
        "jwt_rejected",
      );
      return null;
    }
    if (
      this.expectedAudience !== undefined &&
      !audienceMatches(claims.aud, this.expectedAudience)
    ) {
      logger.warn({ event: "jwt_rejected", reason: "audience_mismatch" }, "jwt_rejected");
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

/**
 * env から iss/aud の期待値 (opt-in) を解決する。
 * Resolve opt-in iss/aud expectations from the environment.
 * Selesaikan ekspektasi iss/aud opt-in dari environment.
 *
 * - SSW_JWT_EXPECTED_ISS: 期待 issuer (例: トークン発行ゲートウェイの URL)
 * - SSW_JWT_EXPECTED_AUD: このリソースサーバーの canonical resource 識別子
 *   (RFC 9728 / RFC 8707)
 *
 * 未設定 (または空) のものは undefined となり、当該クレームの検証はスキップされる。
 * Unset (or empty) values become undefined and the corresponding check is skipped.
 */
function resolveJwtVerifierOptions(): JwtVerifierOptions {
  const options: JwtVerifierOptions = {};
  const expectedIssuer = process.env["SSW_JWT_EXPECTED_ISS"];
  if (expectedIssuer !== undefined && expectedIssuer.length > 0) {
    options.expectedIssuer = expectedIssuer;
  }
  const expectedAudience = process.env["SSW_JWT_EXPECTED_AUD"];
  if (expectedAudience !== undefined && expectedAudience.length > 0) {
    options.expectedAudience = expectedAudience;
  }
  return options;
}

let _verifier: SswCompassTokenVerifier | null = null;

export function getTokenVerifier(): SswCompassTokenVerifier {
  if (_verifierOverride !== null) return _verifierOverride;
  if (_verifier !== null) return _verifier;
  const mode = process.env["SSW_AUTH_MODE"] ?? "jwt";
  if (mode === "anonymous") {
    _verifier = { verify: async (_token) => ANONYMOUS_AUTH_CONTEXT };
  } else {
    _verifier = new JwtTokenVerifier(resolveJwtSecret(), resolveJwtVerifierOptions());
  }
  return _verifier;
}

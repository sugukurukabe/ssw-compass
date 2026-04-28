/**
 * SSW Compass 認証コンテキスト型定義 (ADR-013)
 * Authentication context types for SSW Compass — application-layer JWT (Path Y)
 * Tipe konteks autentikasi untuk SSW Compass — JWT lapisan aplikasi (Path Y)
 *
 * Interface Freeze: Sprint 4 全期間で不変。変更には新 ADR が必要。
 * Interface Freeze: Immutable for all of Sprint 4. New ADR required to change.
 * Pembekuan antarmuka: Tidak berubah selama Sprint 4. ADR baru diperlukan untuk mengubah.
 *
 * See: docs/adr/ADR-013-auth-strategy.md
 */

import { z } from "zod";

/**
 * サービス利用 Tier
 * Service subscription tier
 * Tier langganan layanan
 */
export const AuthTier = z.enum(["free", "pro", "business"]);
export type AuthTier = z.infer<typeof AuthTier>;

/**
 * 認証コンテキスト — tool handler が参照する認証・認可情報
 * Authentication context — auth info referenced by tool handlers
 * Konteks autentikasi — info auth yang dirujuk oleh tool handler
 *
 * anonymous Free: user_id="anonymous", tier="free", auth_source="anonymous"
 * Pro JWT:        claims decoded from HS256 JWT bearer token
 */
export const AuthContext = z
  .object({
    /** 不透明なユーザー識別子 (JWT sub claim or "anonymous") */
    user_id: z.string().min(1).max(128),
    tier: AuthTier,
    /** Pro 以上かつ行政書士会への登録が確認済みか (H01 lockgate で L2/L3 許可条件) */
    gyoseishoshi_verified: z.boolean(),
    /** 登録番号 例: "東京都 12345" — Pro+ かつ gyoseishoshi_verified=true 時のみ存在 */
    gyoseishoshi_number: z
      .string()
      .regex(/^[\u4e00-\u9fa5]+ \d+$/)
      .optional(),
    /** トークン発行手段 */
    auth_source: z.enum(["anonymous", "jwt", "oauth_client_credentials"]),
    /** JWT iat claim (unix seconds); anonymous の場合は 0 */
    issued_at: z.number().int().nonnegative(),
  })
  .strict();
export type AuthContext = z.infer<typeof AuthContext>;

/** Free 匿名ユーザーの AuthContext 定数 */
export const ANONYMOUS_AUTH_CONTEXT = {
  user_id: "anonymous",
  tier: "free" as const,
  gyoseishoshi_verified: false,
  gyoseishoshi_number: undefined,
  auth_source: "anonymous" as const,
  issued_at: 0,
} satisfies AuthContext;

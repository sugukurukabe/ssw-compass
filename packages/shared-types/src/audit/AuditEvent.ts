/**
 * 監査ログイベント型定義 (ADR-015 / v4 §2.5)
 * Audit log event type definition
 * Definisi tipe peristiwa log audit
 *
 * Interface Freeze (ADR-015): AuditEvent shape は Sprint 4 全期間で不変。
 * 新規フィールドは append-only (既存フィールドの削除・rename 不可)。
 *
 * 入力本体・出力本体は保存しない — ハッシュのみ。
 * Input and output content are NOT stored — hashes only.
 * Konten input dan output TIDAK disimpan — hanya hash.
 *
 * 法的根拠: 行政書士法 §9 業務帳簿義務 (7年保存) + APPI 越境移転回避
 */

import { z } from "zod";
import { AuthTier } from "../auth/AuthContext.js";
import { CaseId } from "../case-id.js";
import { LegalLevel } from "../hitl/HitlControl.js";

/**
 * 監査対象アクション一覧
 * Auditable action types
 */
export const AuditAction = z.enum([
  "tool_invoked", // 全 tool 呼び出し (L1 以上)
  "draft_approved", // submit_gyoseishoshi_approval の承認完了
  "draft_rejected", // submit_gyoseishoshi_approval の棄却
  "pii_blocked", // PII ガードによりブロック
  "hitl_gate_rejected", // H01 ロックゲートによりブロック
  "zairyu_compatibility_checked", // validate_zairyu_compatibility の実行
  "document_exported", // pdf_draft / csv 出力 (L2 escalation)
]);
export type AuditAction = z.infer<typeof AuditAction>;

/** sha256 hex 64 文字のパターン */
const SHA256_HEX = z.string().regex(/^[a-f0-9]{64}$/);

export const AuditEvent = z
  .object({
    /** RFC3339 UTC タイムスタンプ */
    timestamp: z.string().datetime(),

    /** 実行者情報 (個人情報は hash のみ) */
    actor: z
      .object({
        /** sha256(user_id) — user_id 本体は保存しない */
        user_id_hash: SHA256_HEX,
        tier: AuthTier,
        /**
         * 行政書士登録番号 (Pro+ かつ gyoseishoshi_verified=true 時のみ)
         * 業務帳簿として番号自体の記録が必要なため hash しない。
         * 例: "東京都 12345"
         */
        gyoseishoshi_number: z.string().optional(),
      })
      .strict(),

    action: AuditAction,

    /** 関連 case_id (tool によっては未発行の場合あり) */
    case_id: CaseId.optional(),

    /** tool 識別子 (snake_case) */
    tool_id: z.string().regex(/^[a-z_]+$/),

    /** 実効法的レベル (per-call escalation 後の値) */
    legal_level: LegalLevel,

    /** sha256(JSON.stringify(input)) — 入力本体は保存しない */
    input_hash: SHA256_HEX,

    /** sha256(JSON.stringify(output)) — 出力本体は保存しない (optional: pii_blocked 時は不在) */
    output_hash: SHA256_HEX.optional(),

    /** 承認署名情報 (draft_approved / draft_rejected 時のみ) */
    approval_signature: z
      .object({
        method: z.enum(["checkbox_only", "checkbox_with_seal", "esign"]),
        /** sha256(seal_image_base64) — 画像本体は保存しない */
        seal_image_hash: SHA256_HEX.optional(),
        /** sha256(ip_address) */
        ip_address_hash: SHA256_HEX.optional(),
      })
      .strict()
      .optional(),

    /** スキーマバージョン (breaking change 時に v2 に上げる) */
    schema_version: z.literal("v1"),
  })
  .strict();

export type AuditEvent = z.infer<typeof AuditEvent>;

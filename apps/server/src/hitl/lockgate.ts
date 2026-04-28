/**
 * HITL H01 ロックゲート実装 (ADR-014 / v4 §2.3)
 * HITL H01 lockgate implementation — blocks L2/L3 for non-qualifying callers
 * Implementasi gerbang kunci HITL H01 — memblokir L2/L3 untuk pemanggil yang tidak memenuhi syarat
 *
 * Interface Freeze (ADR-014): assertHitlGate / assertHitlGateRuntime 関数シグネチャは Sprint 4 不変。
 *
 * 法的根拠:
 * - 改正行政書士法 §19 (2026-01-01 施行)「いかなる名目によるかを問わず」
 * - 入管法 §73-2 (2025-06 施行) 不法就労助長罪厳罰化
 */

import type { AuthContextType as AuthContext, HitlControlId, LegalLevel } from "@ssw/shared-types";
import { logger } from "../logger.js";

/** H01 ロックゲート — ユーザー向け固定メッセージ (変更禁止) */
export const LOCKGATE_MESSAGE_JA =
  "この機能は Pro 以上の行政書士アカウントで認証されたユーザーのみ利用できます。\n" +
  "個別具体の書類作成は、改正行政書士法§19 (2026年1月1日施行) により\n" +
  "行政書士または行政書士法人のみが業として行えます。\n" +
  "- Pro へのアップグレード: https://ssw-compass.jp/upgrade\n" +
  "- 行政書士をお探しの方: https://ssw-compass.jp/find-gyoseishoshi";

export class HitlGateError extends Error {
  constructor(
    public readonly controlId: HitlControlId,
    public readonly userMessage: string,
    public readonly statusCode: 403 | 401 = 403,
  ) {
    super(userMessage);
    this.name = "HitlGateError";
  }
}

/**
 * 静的ゲート — tool の annotations.legalLevel に基づく
 * Static gate — based on tool's annotations.legalLevel
 * Gerbang statis — berdasarkan annotations.legalLevel alat
 *
 * - L0 / L1: 常に通過 (Free 匿名でも OK)
 * - L2 / L3: Pro 以上 かつ gyoseishoshi_verified=true が必要
 */
export function assertHitlGate(
  auth: AuthContext | null | undefined,
  toolId: string,
  legalLevel: LegalLevel,
): void {
  if (legalLevel === "L0" || legalLevel === "L1") return;

  const tier = auth?.tier ?? "free";
  const verified = auth?.gyoseishoshi_verified ?? false;

  if (tier === "free") {
    logger.warn(
      { event: "hitl_gate_rejected", tool_id: toolId, level: legalLevel, reason: "tier_free" },
      "hitl_gate_rejected",
    );
    throw new HitlGateError("H01_DRAFT_LOCKGATE", LOCKGATE_MESSAGE_JA);
  }

  if (!verified) {
    logger.warn(
      {
        event: "hitl_gate_rejected",
        tool_id: toolId,
        level: legalLevel,
        reason: "gyoseishoshi_not_verified",
      },
      "hitl_gate_rejected",
    );
    throw new HitlGateError("H01_DRAFT_LOCKGATE", LOCKGATE_MESSAGE_JA);
  }
}

/**
 * 実行時エスカレーション付きゲート (ADR-014 §2 per-call escalation)
 * Runtime escalation gate — handlers can elevate legalLevel based on input
 * Gerbang eskalasi runtime — handler dapat meningkatkan legalLevel berdasarkan input
 *
 * 使用例 (list_visa_documents で output_format=pdf_draft 時に L1→L2 に escalate):
 *   assertHitlGateRuntime(auth, "list_visa_documents", "L1", effectiveLegalLevel(input))
 *
 * エスカレーション根拠は handler の JSDoc に ADR-014 §Per-call escalation への参照を記載すること。
 */
export function assertHitlGateRuntime(
  auth: AuthContext | null | undefined,
  toolId: string,
  staticLevel: LegalLevel,
  runtimeLevel: LegalLevel,
): void {
  // 静的フロアより緩い runtime レベルは無効 (セキュリティ低下防止)
  const levels: LegalLevel[] = ["L0", "L1", "L2", "L3"];
  const staticIdx = levels.indexOf(staticLevel);
  const runtimeIdx = levels.indexOf(runtimeLevel);
  const effectiveLevel = levels[Math.max(staticIdx, runtimeIdx)] ?? staticLevel;
  assertHitlGate(auth, toolId, effectiveLevel);
}

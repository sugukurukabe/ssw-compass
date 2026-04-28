/**
 * Tier 制限エラー (v4 §3.5 Free tier 3名制限等)
 * Tier limit error for Free/Pro feature restrictions
 * Error batas tier untuk pembatasan fitur Free/Pro
 *
 * Interface Freeze (sprint-4-plan §3.7): TierLimitError shape は Sprint 4 不変。
 */

import type { AuthTier } from "../auth/AuthContext.js";

export class TierLimitError extends Error {
  constructor(
    public readonly tier: AuthTier,
    public readonly limitKind:
      | "cases" // get_deadline_timeline の cases 数上限
      | "staff" // 人材登録数上限
      | "history" // 履歴保持日数上限
      | "language", // 言語機能制限
    public readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "TierLimitError";
  }
}

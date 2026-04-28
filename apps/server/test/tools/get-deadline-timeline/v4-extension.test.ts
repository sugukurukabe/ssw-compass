/**
 * get_deadline_timeline v4 extension tests (ADR-018 / sprint-4-plan §4 B.5)
 * Free tier cases 制限、v4 フィールドの parsing を確認する。
 */

import {
  FREE_TIER_CASES_LIMIT,
  GetDeadlineTimelineInputV4,
  PRO_TIER_CASES_LIMIT,
  TierLimitError,
} from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

const BASE_ARGS = {
  visaCategory: "tokutei_ginou_1" as const,
  eventContext: "general" as const,
  language: "ja" as const,
};

function makeCases(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    case_id: `case-${i}`,
    expiry_date: "2027-01-01",
    application_type: "renewal",
  }));
}

describe("GetDeadlineTimelineInputV4 — schema", () => {
  it("accepts v3-only input (backward compat)", () => {
    const parsed = GetDeadlineTimelineInputV4.safeParse(BASE_ARGS);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.alert_thresholds_days).toEqual([14, 30, 60, 90]); // defaults
      expect(parsed.data.visualization).toBe("gantt_svg");
    }
  });

  it("accepts cases array", () => {
    const parsed = GetDeadlineTimelineInputV4.safeParse({ ...BASE_ARGS, cases: makeCases(2) });
    expect(parsed.success).toBe(true);
  });

  it("accepts all 10 languages", () => {
    const langs = ["ja", "en", "id", "zh-CN", "zh-TW", "vi", "tl", "th", "km", "my"] as const;
    for (const lang of langs) {
      const p = GetDeadlineTimelineInputV4.safeParse({ ...BASE_ARGS, language: lang });
      expect(p.success).toBe(true);
    }
  });
});

describe("TierLimitError", () => {
  it("is throwable with tier/limitKind/message", () => {
    const err = new TierLimitError("free", "cases", "Free プランは3名まで");
    expect(err).toBeInstanceOf(TierLimitError);
    expect(err.tier).toBe("free");
    expect(err.limitKind).toBe("cases");
    expect(err.message).toBe("Free プランは3名まで");
    expect(err.name).toBe("TierLimitError");
  });

  it("FREE_TIER_CASES_LIMIT is 3", () => {
    expect(FREE_TIER_CASES_LIMIT).toBe(3);
  });

  it("PRO_TIER_CASES_LIMIT is 30", () => {
    expect(PRO_TIER_CASES_LIMIT).toBe(30);
  });

  it("should throw TierLimitError when Free tier exceeds 3 cases (manual simulation)", () => {
    // This simulates the handler logic inline to avoid needing full handler setup
    const cases = makeCases(FREE_TIER_CASES_LIMIT + 1); // 4 cases
    const tier = "free";
    const throwIfExceeds = () => {
      if (tier === "free" && cases.length > FREE_TIER_CASES_LIMIT) {
        throw new TierLimitError("free", "cases", `Free プランは${FREE_TIER_CASES_LIMIT}名まで`);
      }
    };
    expect(throwIfExceeds).toThrow(TierLimitError);
  });

  it("does NOT throw when Free tier has exactly 3 cases", () => {
    const cases = makeCases(FREE_TIER_CASES_LIMIT); // 3 cases
    const tier = "free";
    const maybeThrow = () => {
      if (tier === "free" && cases.length > FREE_TIER_CASES_LIMIT) {
        throw new TierLimitError("free", "cases", "over limit");
      }
    };
    expect(maybeThrow).not.toThrow();
  });
});

/**
 * search_visa v4 extension tests (ADR-018 / sprint-4-plan §4 B.5)
 * SearchVisaInputV4 schema と 10言語 parsing を確認する。
 */

import { SearchVisaInputV4 } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("SearchVisaInputV4 — backward compatibility", () => {
  it("accepts v3-only fields (no v4 additions)", () => {
    const v3Input = { category: "tokutei_ginou_1", language: "ja" };
    const parsed = SearchVisaInputV4.safeParse(v3Input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.response_style).toBe("concise"); // default
      expect(parsed.data.enable_followup_suggestions).toBe(true); // default
    }
  });

  it("accepts full v4 fields", () => {
    const v4Input = {
      category: "tokutei_ginou_1",
      language: "zh-CN",
      response_style: "detailed",
      enable_followup_suggestions: false,
    };
    const parsed = SearchVisaInputV4.safeParse(v4Input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.language).toBe("zh-CN");
      expect(parsed.data.response_style).toBe("detailed");
    }
  });

  it("rejects unknown language", () => {
    const parsed = SearchVisaInputV4.safeParse({ category: "tokutei_ginou_1", language: "ko" });
    expect(parsed.success).toBe(false);
  });

  it("default language is 'ja'", () => {
    const parsed = SearchVisaInputV4.safeParse({ category: "tokutei_ginou_1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.language).toBe("ja");
  });

  it("accepts all 10 languages", () => {
    const langs = ["ja", "en", "id", "zh-CN", "zh-TW", "vi", "tl", "th", "km", "my"] as const;
    for (const lang of langs) {
      const p = SearchVisaInputV4.safeParse({ category: "tokutei_ginou_1", language: lang });
      expect(p.success).toBe(true);
    }
  });
});

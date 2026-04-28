/**
 * 10言語 disclaimer injection tests (ADR-018 / sprint-4-plan §4 B.4)
 * DISCLAIMER_BY_LANG が全 10 言語で disclaimer を返すことを確認。
 */

import {
  DISCLAIMER_BY_LANG,
  isVertexGrounded,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  toUILanguage,
  VERTEX_GROUNDED_LANGUAGES,
} from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("DISCLAIMER_BY_LANG", () => {
  it("has entries for all 10 SUPPORTED_LANGUAGES", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(DISCLAIMER_BY_LANG).toHaveProperty(lang);
      expect(typeof DISCLAIMER_BY_LANG[lang as SupportedLanguage]).toBe("string");
      expect((DISCLAIMER_BY_LANG[lang as SupportedLanguage] as string).length).toBeGreaterThan(10);
    }
  });

  it("all disclaimers include the moj.go.jp/isa URL", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(DISCLAIMER_BY_LANG[lang as SupportedLanguage]).toContain("moj.go.jp/isa");
    }
  });

  it("ja disclaimer is in Japanese", () => {
    expect(DISCLAIMER_BY_LANG["ja"]).toContain("行政書士");
  });

  it("en disclaimer is in English", () => {
    expect(DISCLAIMER_BY_LANG["en"]).toContain("general information");
  });

  it("id disclaimer is in Bahasa Indonesia", () => {
    expect(DISCLAIMER_BY_LANG["id"]).toContain("umum");
  });
});

describe("isVertexGrounded (ADR-018)", () => {
  it("returns true for ja/en/id", () => {
    expect(isVertexGrounded("ja")).toBe(true);
    expect(isVertexGrounded("en")).toBe(true);
    expect(isVertexGrounded("id")).toBe(true);
  });

  it("returns false for the other 7 languages", () => {
    const nonGrounded: SupportedLanguage[] = ["zh-CN", "zh-TW", "vi", "tl", "th", "km", "my"];
    for (const lang of nonGrounded) {
      expect(isVertexGrounded(lang)).toBe(false);
    }
  });

  it("VERTEX_GROUNDED_LANGUAGES has exactly 3 items", () => {
    expect(VERTEX_GROUNDED_LANGUAGES).toHaveLength(3);
  });
});

describe("toUILanguage (ADR-018 §3 UI fallback)", () => {
  it("passes through ja/en/id unchanged", () => {
    expect(toUILanguage("ja")).toBe("ja");
    expect(toUILanguage("en")).toBe("en");
    expect(toUILanguage("id")).toBe("id");
  });

  it("maps non-UI languages to 'en'", () => {
    const nonUI: SupportedLanguage[] = ["zh-CN", "zh-TW", "vi", "tl", "th", "km", "my"];
    for (const lang of nonUI) {
      expect(toUILanguage(lang)).toBe("en");
    }
  });
});

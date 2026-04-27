import { describe, expect, it } from "vitest";
import { scrubInputForPII } from "../../src/pii/index.js";

describe("scrubInputForPII — regex stage", () => {
  it("passes through a clean enum-only input", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
    });
    expect(result).toEqual({ blocked: false, types: [] });
  });

  it("blocks a zairyu card number anywhere in the payload", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "my card is AB12345678CD",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("ZAIRYU_CARD_NUMBER");
  });

  it("blocks a passport-shaped token (TK1234567)", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "passport is TK1234567",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("JAPAN_PASSPORT");
  });

  it("blocks a 12-digit my-number only when paired with a hotword", async () => {
    const withHotword = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "私のマイナンバーは 123456789012 です",
    });
    expect(withHotword.blocked).toBe(true);
    expect(withHotword.types).toContain("JAPAN_INDIVIDUAL_NUMBER");

    const withoutHotword = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "the office number is 123456789012",
    });
    expect(withoutHotword.blocked).toBe(false);
    expect(withoutHotword.types).not.toContain("JAPAN_INDIVIDUAL_NUMBER");
  });

  it("does NOT flag a 12-digit number when no hotword is present (false-positive guard)", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "order reference 987654321098 for your records",
    });
    expect(result.blocked).toBe(false);
    expect(result.types).not.toContain("JAPAN_INDIVIDUAL_NUMBER");
  });

  it("does NOT flag a bare hotword without any 12-digit number (false-positive guard)", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "マイナンバー制度の一般的な説明を探しています",
    });
    expect(result.blocked).toBe(false);
    expect(result.types).not.toContain("JAPAN_INDIVIDUAL_NUMBER");
  });

  it("reports multiple hits when several PII types appear", async () => {
    const result = await scrubInputForPII({
      category: "tokutei_ginou_1",
      note: "passport AB1234567 and zairyu AB12345678CD",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toEqual(expect.arrayContaining(["ZAIRYU_CARD_NUMBER", "JAPAN_PASSPORT"]));
  });
});

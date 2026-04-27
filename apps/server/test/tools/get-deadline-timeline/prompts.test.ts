import { describe, expect, it } from "vitest";
import { scrubInputForPII } from "../../../src/pii/index.js";
import { GetDeadlineTimelineInput } from "../../../src/tools/get-deadline-timeline/schema.js";

/**
 * get_deadline_timeline — Direct / Indirect / Negative prompt contracts.
 * Mandatory per .cursor/rules/tools.mdc. Negative cases also feed the
 * Sprint 4 Directory submission packet.
 */

describe("get_deadline_timeline — Direct", () => {
  it("accepts a typical SSW-i renewal timing request", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      eventContext: "status_renewal",
      referenceYearMonth: "2026-09",
      language: "ja",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a straightforward SSW-ii general timeline request (English)", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "tokutei_ginou_2",
      eventContext: "general",
      language: "en",
    });
    expect(r.success).toBe(true);
  });
});

describe("get_deadline_timeline — Indirect", () => {
  it("accepts a contract-starting context implying notification duties", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      eventContext: "contract_start",
      referenceYearMonth: "2026-06",
      language: "id",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a eventContext-omitted query (falls back to general via default)", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "gijinkoku",
      language: "ja",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.eventContext).toBe("general");
    }
  });
});

describe("get_deadline_timeline — Negative (must be refused)", () => {
  it("rejects daily-precision referenceYearMonth (YYYY-MM-DD)", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      eventContext: "status_renewal",
      referenceYearMonth: "2026-09-15",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a free-text visaCategory (prevents enum bypass)", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "AB12345678CD",
      eventContext: "general",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("zod .strict() rejects an unknown additional property (sneaked-in PII-looking field)", () => {
    const r = GetDeadlineTimelineInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      eventContext: "general",
      language: "ja",
      note: "my zairyu card is AB12345678CD",
    });
    expect(r.success).toBe(false);
  });

  it("PII guard: zairyu-shaped payload smuggled via an extra field is blocked at scrubInputForPII", async () => {
    const result = await scrubInputForPII({
      visaCategory: "tokutei_ginou_1",
      eventContext: "general",
      language: "ja",
      freeform: "residence card AB12345678CD here",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("ZAIRYU_CARD_NUMBER");
  });

  it("行政書士法 §73-2 illegal-employment probe carrying a passport number is blocked", async () => {
    const result = await scrubInputForPII({
      visaCategory: "tokutei_ginou_1",
      eventContext: "general",
      language: "ja",
      freeform: "keep working illegally after passport TK1234567 expiry",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("JAPAN_PASSPORT");
  });
});

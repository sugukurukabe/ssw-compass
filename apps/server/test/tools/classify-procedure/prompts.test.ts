import { describe, expect, it } from "vitest";
import { scrubInputForPII } from "../../../src/pii/index.js";
import { ClassifyProcedureInput } from "../../../src/tools/classify-procedure/schema.js";

/**
 * classify_procedure — Direct / Indirect / Negative prompt contracts.
 * Per .cursor/rules/tools.mdc each new tool ships these three classes;
 * negative cases validate both the zod .strict() guard and the PII regex
 * stage. These cases are reused in the Sprint 4 Directory submission packet.
 */

describe("classify_procedure — Direct", () => {
  it("accepts a typical in-country status change request (gijinkoku → tokutei_ginou_1, agriculture)", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "gijinkoku",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      industry: "agriculture",
      language: "ja",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a straightforward overseas new applicant combo", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "no_status",
      targetStatus: "tokutei_ginou_1",
      location: "overseas",
      industry: "nursing_care",
      language: "en",
    });
    expect(r.success).toBe(true);
  });
});

describe("classify_procedure — Indirect", () => {
  it("accepts the technical-intern → SSW bridge pattern without explicit bridge mention", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "ginou_jisshu_2",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      language: "id",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a period-renewal intent expressed as (current == target)", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "tokutei_ginou_1",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      yearMonth: "2026-09",
      language: "ja",
    });
    expect(r.success).toBe(true);
  });
});

describe("classify_procedure — Negative (must be refused)", () => {
  it("zod .strict() rejects free-text currentStatus (prevents enum bypass)", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "AB12345678CD",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("zod .strict() rejects an unknown additional property (e.g., a sneaked-in `note` field)", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "tokutei_ginou_1",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      language: "ja",
      note: "passport TK1234567",
    });
    expect(r.success).toBe(false);
  });

  it("yearMonth rejects non-YYYY-MM input", () => {
    const r = ClassifyProcedureInput.safeParse({
      currentStatus: "tokutei_ginou_1",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      yearMonth: "not-a-date",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("PII guard: zairyu card pattern anywhere in the payload is blocked by scrubInputForPII", async () => {
    const result = await scrubInputForPII({
      currentStatus: "tokutei_ginou_1",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      language: "ja",
      freeform: "my card number is AB12345678CD",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("ZAIRYU_CARD_NUMBER");
  });

  it("行政書士法 §73-2 illegal-employment probe carrying a passport number is blocked", async () => {
    const result = await scrubInputForPII({
      currentStatus: "tokutei_ginou_1",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      language: "ja",
      freeform: "how do I keep working illegally with passport TK1234567",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("JAPAN_PASSPORT");
  });
});

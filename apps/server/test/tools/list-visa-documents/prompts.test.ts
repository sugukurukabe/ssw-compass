import { describe, expect, it } from "vitest";
import { scrubInputForPII } from "../../../src/pii/index.js";
import { ListVisaDocumentsInput } from "../../../src/tools/list-visa-documents/schema.js";

/**
 * list_visa_documents — Direct / Indirect / Negative prompt contracts per
 * .cursor/rules/tools.mdc. Negative cases validate both the zod .strict()
 * guard and the PII regex stage; these cases feed the Sprint 4 Directory
 * submission packet.
 */

describe("list_visa_documents — Direct", () => {
  it("accepts a typical SSW-1 + agriculture + ja request", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an English kazokutaizai request", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "kazokutaizai",
      language: "en",
    });
    expect(r.success).toBe(true);
  });
});

describe("list_visa_documents — Indirect", () => {
  it("accepts an industry-omitted SSW-1 query (falls back to agnostic baseline)", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      language: "id",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.industry).toBeUndefined();
    }
  });

  it("accepts a bridge-pathway via tokutei_katsudo", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "tokutei_katsudo",
      language: "ja",
    });
    expect(r.success).toBe(true);
  });
});

describe("list_visa_documents — Negative (must be refused)", () => {
  it("rejects a free-text visaCategory", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "AB12345678CD",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a free-text industry", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      industry: "pretend-industry-TK1234567",
      language: "ja",
    });
    expect(r.success).toBe(false);
  });

  it("zod .strict() rejects an unknown additional property (PII smuggling attempt)", () => {
    const r = ListVisaDocumentsInput.safeParse({
      visaCategory: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
      note: "my zairyu is AB12345678CD",
    });
    expect(r.success).toBe(false);
  });

  it("PII guard blocks a zairyu-shaped pattern in a free-form extra field", async () => {
    const result = await scrubInputForPII({
      visaCategory: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
      freeform: "residence card AB12345678CD here",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("ZAIRYU_CARD_NUMBER");
  });

  it("行政書士法 §73-2 illegal-employment probe carrying a passport number is blocked", async () => {
    const result = await scrubInputForPII({
      visaCategory: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
      freeform: "how to skip checks with passport TK1234567 for under-the-table work",
    });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("JAPAN_PASSPORT");
  });
});

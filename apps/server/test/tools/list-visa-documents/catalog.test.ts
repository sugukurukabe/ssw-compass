import type { ListVisaDocumentsInput } from "@vcj/shared-types";
import { describe, expect, it } from "vitest";
import { lookupDocuments } from "../../../src/tools/list-visa-documents/document-catalog.js";

function mk(overrides: Partial<ListVisaDocumentsInput>): ListVisaDocumentsInput {
  return {
    visaCategory: "tokutei_ginou_1",
    language: "ja",
    ...overrides,
  };
}

describe("lookupDocuments — catalog", () => {
  it("SSW-1 + agriculture → 8 documents (baseline 5 + skill cert + jlpt + maff plan)", () => {
    const docs = lookupDocuments(mk({ visaCategory: "tokutei_ginou_1", industry: "agriculture" }));
    expect(docs.length).toBe(8);
    const ids = docs.map((d) => d.id);
    expect(ids).toContain("employment_contract");
    expect(ids).toContain("skill_test_certificate");
    expect(ids).toContain("japanese_test_certificate");
    expect(ids).toContain("maff_agriculture_plan");
  });

  it("SSW-1 without industry → 5 industry-agnostic documents", () => {
    const docs = lookupDocuments(mk({ visaCategory: "tokutei_ginou_1" }));
    expect(docs.length).toBe(5);
    const ids = docs.map((d) => d.id);
    expect(ids).not.toContain("skill_test_certificate");
    expect(ids).not.toContain("maff_agriculture_plan");
  });

  it("all document ids are unique within every visa-category bucket", () => {
    const visaCategories: ListVisaDocumentsInput["visaCategory"][] = [
      "tokutei_ginou_1",
      "tokutei_ginou_2",
      "ginou_jisshu",
      "tokutei_katsudo",
      "gijinkoku",
      "kazokutaizai",
    ];
    for (const visaCategory of visaCategories) {
      const docs = lookupDocuments(mk({ visaCategory }));
      const ids = docs.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every document has trustLevel primary_source in Sprint 2 Batch 5 fixture", () => {
    const docs = lookupDocuments(mk({ visaCategory: "tokutei_ginou_1", industry: "agriculture" }));
    expect(docs.every((d) => d.trustLevel === "primary_source")).toBe(true);
  });

  it("kazokutaizai returns at least one document", () => {
    const docs = lookupDocuments(mk({ visaCategory: "kazokutaizai" }));
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });

  it("other returns an empty array (handler will emit a general-information message)", () => {
    const docs = lookupDocuments(mk({ visaCategory: "other" }));
    expect(docs.length).toBe(0);
  });
});

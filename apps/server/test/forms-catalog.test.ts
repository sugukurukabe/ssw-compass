import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FormsCatalogEntry } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { buildFormBundle, loadFormsCatalog } from "../src/forms-catalog.js";

async function readCatalogLines(): Promise<unknown[]> {
  const text = await readFile(
    resolve(process.cwd(), "..", "..", "data", "forms-catalog.jsonl"),
    "utf-8",
  );
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

describe("forms-catalog", () => {
  it("parses every JSONL line with the shared schema", async () => {
    const rows = await readCatalogLines();
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      expect(() => FormsCatalogEntry.parse(row)).not.toThrow();
    }
  });

  it("contains the minimum Sprint 5 classifier entries", async () => {
    const entries = await loadFormsCatalog();
    const ids = entries.map((entry) => entry.id);
    expect(ids).toContain("ssw1-change-table1");
    expect(ids).toContain("ssw1-agriculture-table3");
    expect(ids).toContain("ref-1-17-support-plan");
    expect(ids).toContain("ref-1-29-omission-pledge");
    expect(ids).toContain("org-profile-same-fiscal-year-repeat");
    expect(ids).toContain("applicant-profile-technical-intern-2-same-field");
  });

  it("all public URLs stay on moj.go.jp official origins", async () => {
    const entries = await loadFormsCatalog();
    for (const entry of entries) {
      if ("url" in entry) {
        expect(new URL(entry.url).hostname).toBe("www.moj.go.jp");
      }
      if ("officialReferencePage" in entry) {
        expect(new URL(entry.officialReferencePage).hostname).toBe("www.moj.go.jp");
      }
    }
  });

  it("buildFormBundle omits Table 2 for renewal", () => {
    const bundle = buildFormBundle({
      procedure: "renewal",
      sswLevel: "i",
      receivingOrganizationProfile: "not_applicable",
      applicantProfile: "no_exemption",
      industry: "agriculture",
      officialReferencePage:
        "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
    });
    expect(bundle.requiredSections).toEqual(["table1", "table3"]);
    expect(bundle.omittedSections).toEqual(["table2_1", "table2_2", "table2_3"]);
  });

  it("buildFormBundle selects the correct Table 2 branch for corporations", () => {
    const bundle = buildFormBundle({
      procedure: "change",
      sswLevel: "i",
      receivingOrganizationProfile: "corporation",
      applicantProfile: "no_exemption",
      industry: "agriculture",
      officialReferencePage:
        "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
    });
    expect(bundle.requiredSections).toEqual(["table1", "table2_2", "table3"]);
    expect(bundle.omittedSections).toEqual(["table2_1", "table2_3"]);
  });

  it("buildFormBundle maps detailed Table 2-1 eligible profiles to Table 2-1", () => {
    for (const receivingOrganizationProfile of [
      "listed_company",
      "mutual_company",
      "innovation_company",
      "withholding_tax_10m",
      "continuous_acceptance_3y",
    ] as const) {
      const bundle = buildFormBundle({
        procedure: "change",
        sswLevel: "i",
        receivingOrganizationProfile,
        applicantProfile: "no_exemption",
        industry: "agriculture",
        officialReferencePage:
          "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
      });
      expect(bundle.requiredSections).toEqual(["table1", "table2_1", "table3"]);
      expect(bundle.omittedSections).toEqual(["table2_2", "table2_3"]);
    }
  });
});

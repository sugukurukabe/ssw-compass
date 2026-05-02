/**
 * list_visa_documents output format tests.
 * Public submission surface is read-only: json / html_preview only.
 */

import { DocumentOutputFormat, ListVisaDocumentsInputV4 } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("ListVisaDocumentsInputV4 schema", () => {
  it("default output_format is json", () => {
    const p = ListVisaDocumentsInputV4.safeParse({ visaCategory: "tokutei_ginou_1" });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.output_format).toBe("json");
  });

  it("accepts html_preview", () => {
    const p = ListVisaDocumentsInputV4.safeParse({
      visaCategory: "tokutei_ginou_1",
      output_format: "html_preview",
    });
    expect(p.success).toBe(true);
  });

  it("rejects pdf_draft and csv", () => {
    for (const output_format of ["pdf_draft", "csv"]) {
      const p = ListVisaDocumentsInputV4.safeParse({
        visaCategory: "tokutei_ginou_1",
        output_format,
      });
      expect(p.success).toBe(false);
    }
  });

  it("rejects unknown output_format", () => {
    const p = ListVisaDocumentsInputV4.safeParse({
      visaCategory: "tokutei_ginou_1",
      output_format: "word",
    });
    expect(p.success).toBe(false);
  });

  it("DocumentOutputFormat enum has read-only values", () => {
    const result = DocumentOutputFormat.safeParse("json");
    expect(result.success).toBe(true);
    for (const v of ["json", "html_preview"]) {
      expect(DocumentOutputFormat.safeParse(v).success).toBe(true);
    }
  });
});

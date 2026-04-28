/**
 * list_visa_documents PDF/CSV gating tests (ADR-020 / sprint-4-plan §4 B.5)
 * effectiveLegalLevel() と TierLimitError の組み合わせを確認する。
 */

import type { AuthContextType } from "@ssw/shared-types";
import {
  DocumentOutputFormat,
  effectiveLegalLevel,
  ListVisaDocumentsInputV4,
} from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { assertHitlGateRuntime, HitlGateError } from "../../../src/hitl/lockgate.js";

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

const FREE_AUTH: AuthContextType = {
  user_id: "anon",
  tier: "free",
  gyoseishoshi_verified: false,
  auth_source: "anonymous",
  issued_at: 0,
};

describe("effectiveLegalLevel (ADR-020 §2)", () => {
  it("json → L1", () => {
    expect(effectiveLegalLevel({ output_format: "json" })).toBe("L1");
  });

  it("html_preview → L1", () => {
    expect(effectiveLegalLevel({ output_format: "html_preview" })).toBe("L1");
  });

  it("pdf_draft → L2", () => {
    expect(effectiveLegalLevel({ output_format: "pdf_draft" })).toBe("L2");
  });

  it("csv → L2", () => {
    expect(effectiveLegalLevel({ output_format: "csv" })).toBe("L2");
  });
});

describe("PDF/CSV gating — HitlGateRuntime integration", () => {
  it("Free × json → passes", () => {
    expect(() =>
      assertHitlGateRuntime(
        FREE_AUTH,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "json" }),
      ),
    ).not.toThrow();
  });

  it("Free × html_preview → passes", () => {
    expect(() =>
      assertHitlGateRuntime(
        FREE_AUTH,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "html_preview" }),
      ),
    ).not.toThrow();
  });

  it("Free × pdf_draft → HitlGateError (L2 escalation)", () => {
    expect(() =>
      assertHitlGateRuntime(
        FREE_AUTH,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "pdf_draft" }),
      ),
    ).toThrow(HitlGateError);
  });

  it("Free × csv → HitlGateError", () => {
    expect(() =>
      assertHitlGateRuntime(
        FREE_AUTH,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "csv" }),
      ),
    ).toThrow(HitlGateError);
  });

  it("Pro+gyoseishoshi × pdf_draft → passes", () => {
    expect(() =>
      assertHitlGateRuntime(
        PRO_GYO,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "pdf_draft" }),
      ),
    ).not.toThrow();
  });

  it("Pro+gyoseishoshi × csv → passes", () => {
    expect(() =>
      assertHitlGateRuntime(
        PRO_GYO,
        "list_visa_documents",
        "L1",
        effectiveLegalLevel({ output_format: "csv" }),
      ),
    ).not.toThrow();
  });
});

describe("ListVisaDocumentsInputV4 schema", () => {
  it("default output_format is json", () => {
    const p = ListVisaDocumentsInputV4.safeParse({ visaCategory: "tokutei_ginou_1" });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.output_format).toBe("json");
  });

  it("accepts pdf_draft", () => {
    const p = ListVisaDocumentsInputV4.safeParse({
      visaCategory: "tokutei_ginou_1",
      output_format: "pdf_draft",
    });
    expect(p.success).toBe(true);
  });

  it("rejects unknown output_format", () => {
    const p = ListVisaDocumentsInputV4.safeParse({
      visaCategory: "tokutei_ginou_1",
      output_format: "word",
    });
    expect(p.success).toBe(false);
  });

  it("DocumentOutputFormat enum has 4 values", () => {
    const result = DocumentOutputFormat.safeParse("json");
    expect(result.success).toBe(true);
    for (const v of ["json", "html_preview", "pdf_draft", "csv"]) {
      expect(DocumentOutputFormat.safeParse(v).success).toBe(true);
    }
  });
});

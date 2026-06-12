import { describe, expect, it } from "vitest";
import {
  buildDocumentPackageArtifact,
  generateDocumentPackageTaskId,
} from "../../../src/tools/prepare-document-package/service.js";

describe("prepare_document_package service", () => {
  it("generates task IDs with the frozen prefix", () => {
    expect(generateDocumentPackageTaskId()).toMatch(/^task_[A-Za-z0-9_-]{22}$/);
  });

  it("builds a JSON artifact without personal identifiers", () => {
    const artifact = buildDocumentPackageArtifact({
      procedure_type: "zairyu_shikaku_henko",
      visa_category: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
      case_handle: "SAMPLE-CASE-0001",
      idempotency_key: "idem-sample-0001",
    });
    const parsed = JSON.parse(artifact.toString("utf8")) as Record<string, unknown>;
    expect(parsed["product"]).toBe("SSW Compass");
    expect(parsed["case_handle"]).toBe("SAMPLE-CASE-0001");
    expect(JSON.stringify(parsed)).not.toContain("passport");
    expect(JSON.stringify(parsed)).not.toContain("residence card");
  });
});

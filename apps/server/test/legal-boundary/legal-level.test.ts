/**
 * Legal boundary tests — static legalLevel enforcement for existing 4 tools (ADR-014)
 * 既存 4 tools の annotation が正しく設定されており、validateToolAnnotations を通過することを確認。
 */

import { describe, expect, it } from "vitest";
import { validateToolAnnotations } from "../../src/hitl/validate-annotations.js";
import { CLASSIFY_PROCEDURE_ANNOTATION } from "../../src/tools/classify-procedure/index.js";
import { GET_DEADLINE_TIMELINE_ANNOTATION } from "../../src/tools/get-deadline-timeline/index.js";
import { LIST_LAW_UPDATES_ANNOTATION } from "../../src/tools/list-law-updates/index.js";
import { LIST_VISA_DOCUMENTS_ANNOTATION } from "../../src/tools/list-visa-documents/index.js";
import { SEARCH_VISA_ANNOTATION } from "../../src/tools/search-visa/index.js";
import { VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION } from "../../src/tools/validate-zairyu-compatibility/index.js";

describe("public tools — annotation correctness", () => {
  it("search_visa: L0, free, no gyoseishoshi required", () => {
    expect(SEARCH_VISA_ANNOTATION.legalLevel).toBe("L0");
    expect(SEARCH_VISA_ANNOTATION.tier).toBe("free");
    expect(SEARCH_VISA_ANNOTATION.requiresGyoseishoshiAuth).toBe(false);
  });

  it("classify_procedure: L1, free", () => {
    expect(CLASSIFY_PROCEDURE_ANNOTATION.legalLevel).toBe("L1");
    expect(CLASSIFY_PROCEDURE_ANNOTATION.tier).toBe("free");
  });

  it("get_deadline_timeline: L1, free", () => {
    expect(GET_DEADLINE_TIMELINE_ANNOTATION.legalLevel).toBe("L1");
    expect(GET_DEADLINE_TIMELINE_ANNOTATION.tier).toBe("free");
  });

  it("list_visa_documents: static floor L1 (escalates to L2 for pdf_draft/csv)", () => {
    expect(LIST_VISA_DOCUMENTS_ANNOTATION.legalLevel).toBe("L1");
    expect(LIST_VISA_DOCUMENTS_ANNOTATION.requiresGyoseishoshiAuth).toBe(false);
  });

  it("all 4 tools pass validateToolAnnotations at startup", () => {
    expect(() =>
      validateToolAnnotations([
        { name: "search_visa", annotations: SEARCH_VISA_ANNOTATION },
        { name: "classify_procedure", annotations: CLASSIFY_PROCEDURE_ANNOTATION },
        { name: "get_deadline_timeline", annotations: GET_DEADLINE_TIMELINE_ANNOTATION },
        { name: "list_visa_documents", annotations: LIST_VISA_DOCUMENTS_ANNOTATION },
        { name: "list_law_updates", annotations: LIST_LAW_UPDATES_ANNOTATION },
        {
          name: "validate_zairyu_compatibility",
          annotations: VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
        },
      ]),
    ).not.toThrow();
  });

  it("all L0/L1 tools have H07_PII_AUTO_MASKING in hitlControls", () => {
    for (const ann of [
      SEARCH_VISA_ANNOTATION,
      CLASSIFY_PROCEDURE_ANNOTATION,
      GET_DEADLINE_TIMELINE_ANNOTATION,
      LIST_VISA_DOCUMENTS_ANNOTATION,
      LIST_LAW_UPDATES_ANNOTATION,
      VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION,
    ]) {
      expect(ann.hitlControls).toContain("H07_PII_AUTO_MASKING");
    }
  });

  it("validate_zairyu_compatibility exposes the H06 illegal-work alert control", () => {
    expect(VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION.legalLevel).toBe("L1");
    expect(VALIDATE_ZAIRYU_COMPATIBILITY_ANNOTATION.hitlControls).toContain(
      "H06_ILLEGAL_WORK_ALERT",
    );
  });
});

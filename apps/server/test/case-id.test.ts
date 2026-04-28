/**
 * case_id generation tests (ADR-014)
 */

import { CASE_ID_PATTERN, CaseId, generateCaseId } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("generateCaseId", () => {
  it("generated id matches pattern /^case_[a-z0-9]{16}$/", () => {
    const id = generateCaseId();
    expect(CASE_ID_PATTERN.test(id)).toBe(true);
  });

  it("generated ids are unique (100 samples)", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateCaseId()));
    expect(ids.size).toBe(100);
  });

  it("CaseId zod schema accepts valid id", () => {
    const id = generateCaseId();
    expect(() => CaseId.parse(id)).not.toThrow();
  });

  it("CaseId zod schema rejects malformed ids", () => {
    expect(() => CaseId.parse("case_ABC123")).toThrow(); // uppercase
    expect(() => CaseId.parse("case_too_short")).toThrow(); // wrong format
    expect(() => CaseId.parse("notcase_abcd1234efgh5678")).toThrow(); // wrong prefix
    expect(() => CaseId.parse("case_abcd1234efgh5678x")).toThrow(); // 17 chars
  });
});

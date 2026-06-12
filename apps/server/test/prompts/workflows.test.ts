import { describe, expect, it } from "vitest";
import { buildNewStaffIntakePromptText, prefixFilter } from "../../src/prompts/workflows.js";

describe("workflow prompts", () => {
  it("builds the new staff intake prompt with the required workflow guardrails", () => {
    const text = buildNewStaffIntakePromptText({
      current_status: "技能実習2号",
      target_status: "特定技能1号",
      industry: "農業",
      intended_work: "農作業全般",
      reference_year_month: "2026-07",
    });

    expect(text).toContain("新人スタッフ向けの初回確認");
    expect(text).toContain("classify_procedure");
    expect(text).toContain("list_visa_documents");
    expect(text).toContain("validate_zairyu_compatibility");
    expect(text).toContain("在留カード番号");
  });
});

describe("prompt argument completion (prefixFilter)", () => {
  const candidates = ["農業", "漁業", "建設", "介護"] as const;

  it("returns all candidates for empty input", () => {
    expect(prefixFilter(candidates)("")).toEqual([...candidates]);
    expect(prefixFilter(candidates)(undefined)).toEqual([...candidates]);
  });

  it("filters by prefix", () => {
    expect(prefixFilter(candidates)("農")).toEqual(["農業"]);
    expect(prefixFilter(candidates)("漁")).toEqual(["漁業"]);
  });

  it("returns empty when no candidate matches", () => {
    expect(prefixFilter(candidates)("航空")).toEqual([]);
  });
});

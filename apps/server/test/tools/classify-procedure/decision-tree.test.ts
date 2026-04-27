import type { ClassifyProcedureInput } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { classifyProcedure } from "../../../src/tools/classify-procedure/decision-tree.js";

type Lang = ClassifyProcedureInput["language"];

function mkArgs(overrides: Partial<ClassifyProcedureInput>): ClassifyProcedureInput {
  return {
    currentStatus: "no_status",
    targetStatus: "tokutei_ginou_1",
    location: "overseas",
    language: "ja" as Lang,
    ...overrides,
  };
}

describe("classifyProcedure — decision tree", () => {
  it("R1: overseas new applicant → ninte_shoumeisho_koufu", () => {
    const d = classifyProcedure(
      mkArgs({ currentStatus: "no_status", targetStatus: "tokutei_ginou_1", location: "overseas" }),
    );
    expect(d.type).toBe("ninte_shoumeisho_koufu");
    expect(d.ruleId).toBe("R1.overseas_new");
  });

  it("R2: ginou_jisshu_2 → tokutei_ginou_1 in Japan → bridge", () => {
    const d = classifyProcedure(
      mkArgs({
        currentStatus: "ginou_jisshu_2",
        targetStatus: "tokutei_ginou_1",
        location: "japan",
      }),
    );
    expect(d.type).toBe("tokutei_katsudo_bridge");
    expect(d.ruleId).toBe("R2.ginou_to_tg1");
  });

  it("R2: ginou_jisshu_3 → tokutei_ginou_1 in Japan → bridge", () => {
    const d = classifyProcedure(
      mkArgs({
        currentStatus: "ginou_jisshu_3",
        targetStatus: "tokutei_ginou_1",
        location: "japan",
      }),
    );
    expect(d.type).toBe("tokutei_katsudo_bridge");
    expect(d.ruleId).toBe("R2.ginou_to_tg1");
  });

  it("R3: same status in Japan → zairyu_kikan_koshin (renewal)", () => {
    const d = classifyProcedure(
      mkArgs({
        currentStatus: "tokutei_ginou_1",
        targetStatus: "tokutei_ginou_1",
        location: "japan",
      }),
    );
    expect(d.type).toBe("zairyu_kikan_koshin");
    expect(d.ruleId).toBe("R3.same_status_renewal");
  });

  it("R4: no_status + japan → not_applicable (requires gyoseishoshi)", () => {
    const d = classifyProcedure(
      mkArgs({ currentStatus: "no_status", targetStatus: "tokutei_ginou_1", location: "japan" }),
    );
    expect(d.type).toBe("not_applicable");
    expect(d.ruleId).toBe("R4.no_status_in_japan");
  });

  it("R5: different status change in Japan → zairyu_shikaku_henko", () => {
    const d = classifyProcedure(
      mkArgs({ currentStatus: "gijinkoku", targetStatus: "tokutei_ginou_1", location: "japan" }),
    );
    expect(d.type).toBe("zairyu_shikaku_henko");
    expect(d.ruleId).toBe("R5.status_change");
  });

  it("R1 precedence: overseas always wins over (current == target)", () => {
    const d = classifyProcedure(
      mkArgs({
        currentStatus: "tokutei_ginou_1",
        targetStatus: "tokutei_ginou_1",
        location: "overseas",
      }),
    );
    expect(d.type).toBe("ninte_shoumeisho_koufu");
  });

  it("industry does not affect the decision in Sprint 2", () => {
    const withIndustry = classifyProcedure(
      mkArgs({
        currentStatus: "gijinkoku",
        targetStatus: "tokutei_ginou_1",
        location: "japan",
        industry: "agriculture",
      }),
    );
    const withoutIndustry = classifyProcedure(
      mkArgs({
        currentStatus: "gijinkoku",
        targetStatus: "tokutei_ginou_1",
        location: "japan",
      }),
    );
    expect(withIndustry.type).toBe(withoutIndustry.type);
    expect(withIndustry.ruleId).toBe(withoutIndustry.ruleId);
  });
});

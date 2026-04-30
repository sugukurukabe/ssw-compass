import type { GetDeadlineTimelineInput } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import {
  computeTimeline,
  subtractMonths,
} from "../../../src/tools/get-deadline-timeline/deadline-calc.js";

function mkArgs(overrides: Partial<GetDeadlineTimelineInput>): GetDeadlineTimelineInput {
  return {
    visaCategory: "tokutei_ginou_1",
    eventContext: "general",
    language: "ja",
    ...overrides,
  };
}

describe("computeTimeline — deadline calculation", () => {
  it("tokutei_ginou_1 / general / referenceYearMonth 提供 → 4 deadlines with renewal_earliest = -3 months", () => {
    const out = computeTimeline(
      mkArgs({
        visaCategory: "tokutei_ginou_1",
        eventContext: "general",
        referenceYearMonth: "2026-09",
      }),
    );
    expect(out.length).toBe(4);
    const kinds = out.map((d) => d.kind);
    expect(kinds).toEqual([
      "notification_14days",
      "annual_report",
      "renewal_earliest",
      "tokutei_ginou_1_cap",
    ]);
    const renewal = out.find((d) => d.kind === "renewal_earliest");
    expect(renewal?.dueBy).toBe("2026-06");
  });

  it("tokutei_ginou_1 / general / referenceYearMonth 省略 → renewal_earliest.dueBy が undefined", () => {
    const out = computeTimeline(
      mkArgs({ visaCategory: "tokutei_ginou_1", eventContext: "general" }),
    );
    const renewal = out.find((d) => d.kind === "renewal_earliest");
    expect(renewal).toBeDefined();
    expect(renewal?.dueBy).toBeUndefined();
  });

  it("contract_end → notification_14days のみ", () => {
    const out = computeTimeline(mkArgs({ eventContext: "contract_end" }));
    expect(out.length).toBe(1);
    expect(out[0]?.kind).toBe("notification_14days");
  });

  it("support_plan_change → 14日以内届出 + 関連様式", () => {
    const out = computeTimeline(mkArgs({ eventContext: "support_plan_change" }));
    expect(out.map((d) => d.kind)).toEqual(["notification_14days"]);
    expect(out[0]?.relatedForms?.[0]?.id).toBe("ref-3-2-support-plan-change");
  });

  it("regular_report → annual_report のみ", () => {
    const out = computeTimeline(mkArgs({ eventContext: "regular_report" }));
    expect(out.map((d) => d.kind)).toEqual(["annual_report"]);
    expect(out[0]?.relatedForms?.[0]?.id).toBe("ref-3-6-regular-report");
  });

  it("ginou_jisshu / bridge_transition → bridge_preparation のみ", () => {
    const out = computeTimeline(
      mkArgs({ visaCategory: "ginou_jisshu", eventContext: "bridge_transition" }),
    );
    expect(out.length).toBe(1);
    expect(out[0]?.kind).toBe("bridge_preparation");
  });

  it("tokutei_ginou_2 / general → tokutei_ginou_1_cap を含まない", () => {
    const out = computeTimeline(
      mkArgs({ visaCategory: "tokutei_ginou_2", eventContext: "general" }),
    );
    const kinds = out.map((d) => d.kind);
    expect(kinds).not.toContain("tokutei_ginou_1_cap");
    expect(kinds).toEqual(["notification_14days", "annual_report", "renewal_earliest"]);
  });

  it("subtractMonths: 跨年境界が正しい (2026-02 -3 months = 2025-11)", () => {
    expect(subtractMonths("2026-02", 3)).toBe("2025-11");
    expect(subtractMonths("2026-01", 1)).toBe("2025-12");
    expect(subtractMonths("2026-09", 3)).toBe("2026-06");
    expect(subtractMonths("2026-12", 12)).toBe("2025-12");
  });
});

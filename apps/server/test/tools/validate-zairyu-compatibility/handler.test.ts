/**
 * validate_zairyu_compatibility tests (ADR-014 H06 / sprint-4-plan §4 B.5)
 */

import { describe, expect, it } from "vitest";
import { validateZairyuCompatibilityHandler } from "../../../src/tools/validate-zairyu-compatibility/handler.js";

const FUTURE_DATE = new Date();
FUTURE_DATE.setFullYear(FUTURE_DATE.getFullYear() + 2);
const FUTURE = FUTURE_DATE.toISOString().slice(0, 10);

const PAST_DATE = new Date();
PAST_DATE.setDate(PAST_DATE.getDate() - 1);
const PAST = PAST_DATE.toISOString().slice(0, 10);

describe("validate_zairyu_compatibility", () => {
  it("tokutei_ginou_1 + agriculture + valid expiry → OK", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "tokutei_ginou_1",
      intended_industry: "agriculture",
      intended_task: "野菜の栽培・収穫",
      expiry_date: FUTURE,
    });
    const sc = result.structuredContent as {
      compatibility: string;
      escalate_to_professional: boolean;
    };
    expect(sc.compatibility).toBe("OK");
    expect(sc.escalate_to_professional).toBe(false);
  });

  it("ryugaku + agriculture → ILLEGAL (就労不可)", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "ryugaku",
      intended_industry: "agriculture",
      intended_task: "農業",
      expiry_date: FUTURE,
    });
    const sc = result.structuredContent as {
      compatibility: string;
      escalate_to_professional: boolean;
      legal_basis: string[];
    };
    expect(sc.compatibility).toBe("ILLEGAL");
    expect(sc.escalate_to_professional).toBe(true);
    expect(sc.legal_basis).toContain("入管法 §73-2");
  });

  it("kazoku_taizai + construction → ILLEGAL", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "kazoku_taizai",
      intended_industry: "construction",
      intended_task: "建設作業",
      expiry_date: FUTURE,
    });
    const sc = result.structuredContent as { compatibility: string };
    expect(sc.compatibility).toBe("ILLEGAL");
  });

  it("expired expiry_date → ILLEGAL (オーバーステイ)", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "tokutei_ginou_1",
      intended_industry: "agriculture",
      intended_task: "農業",
      expiry_date: PAST,
    });
    const sc = result.structuredContent as { compatibility: string };
    expect(sc.compatibility).toBe("ILLEGAL");
  });

  it("ILLEGAL output includes escalate_to_professional=true", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "ryugaku",
      intended_industry: "agriculture",
      intended_task: "農業",
      expiry_date: FUTURE,
    });
    const sc = result.structuredContent as { escalate_to_professional: boolean };
    expect(sc.escalate_to_professional).toBe(true);
  });

  it("result includes disclaimer", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "tokutei_ginou_1",
      intended_industry: "fishery",
      intended_task: "漁業",
      expiry_date: FUTURE,
    });
    const sc = result.structuredContent as { disclaimer: string };
    expect(sc.disclaimer).toContain("moj.go.jp/isa");
  });

  it("response content text includes compatibility result", async () => {
    const result = await validateZairyuCompatibilityHandler({
      zairyu_status: "tokutei_ginou_1",
      intended_industry: "agriculture",
      intended_task: "農業",
      expiry_date: FUTURE,
    });
    expect((result.content[0] as { text: string }).text).toContain("OK");
  });
});

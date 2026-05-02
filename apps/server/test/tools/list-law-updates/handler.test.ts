/**
 * list_law_updates handler tests (Batch 9 / sprint-4-plan §4 B.5)
 * fixture の entries がフィルタリングされて返ることを確認。
 */

import { describe, expect, it } from "vitest";
import { listLawUpdatesHandler } from "../../../src/tools/list-law-updates/handler.js";

describe("list_law_updates handler — basic", () => {
  it("returns active entries with default args", async () => {
    const result = await listLawUpdatesHandler({});
    expect(result.isError).toBeFalsy();
    const content = result.structuredContent as {
      updates: unknown[];
      asOf: string;
      disclaimer: string;
    };
    expect(Array.isArray(content.updates)).toBe(true);
    expect(content.updates.length).toBeGreaterThan(0);
    expect(typeof content.disclaimer).toBe("string");
  });

  it("filters by category immigration_act", async () => {
    const result = await listLawUpdatesHandler({ category: "immigration_act" });
    const content = result.structuredContent as { updates: { category: string }[] };
    for (const u of content.updates) {
      expect(u.category).toBe("immigration_act");
    }
  });

  it("respects limit=1", async () => {
    const result = await listLawUpdatesHandler({ limit: 1 });
    const content = result.structuredContent as { updates: unknown[] };
    expect(content.updates.length).toBeLessThanOrEqual(1);
  });

  it("returns disclaimer in Japanese by default", async () => {
    const result = await listLawUpdatesHandler({});
    const content = result.structuredContent as { disclaimer: string };
    expect(content.disclaimer).toContain("行政書士");
  });

  it("result text includes entry titles", async () => {
    const result = await listLawUpdatesHandler({ category: "immigration_act" });
    expect(typeof result.content[0]?.text).toBe("string");
    expect((result.content[0] as { text: string }).text).toContain("入管法");
  });

  it("severity=critical entries found in all-category query", async () => {
    const result = await listLawUpdatesHandler({});
    const content = result.structuredContent as { updates: { impact_severity: string }[] };
    const criticals = content.updates.filter((u) => u.impact_severity === "critical");
    expect(criticals.length).toBeGreaterThanOrEqual(1);
  });

  it("output shape matches ListLawUpdatesOutput structure", async () => {
    const result = await listLawUpdatesHandler({});
    const content = result.structuredContent as Record<string, unknown>;
    expect(content).toHaveProperty("updates");
    expect(content).toHaveProperty("asOf");
    expect(content).toHaveProperty("disclaimer");
  });
});

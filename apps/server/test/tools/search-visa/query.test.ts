import { describe, expect, it } from "vitest";
import { buildQuery } from "../../../src/tools/search-visa/schema.js";

describe("search_visa buildQuery", () => {
  it("expands construction enum into Japanese sector and ministry terms", () => {
    const query = buildQuery({
      category: "tokutei_ginou_1",
      industry: "construction",
      language: "ja",
    });
    expect(query).toContain("特定技能1号");
    expect(query).toContain("建設");
    expect(query).toContain("国土交通省");
    expect(query).not.toContain("tokutei_ginou_1");
  });

  it("expands agriculture enum into Japanese sector and ministry terms", () => {
    const query = buildQuery({
      category: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
    });
    expect(query).toContain("農業");
    expect(query).toContain("農林水産省");
  });
});

import { describe, expect, it } from "vitest";
import { sourceAllowlistForIndustry } from "../src/industry-routing.js";

describe("sourceAllowlistForIndustry", () => {
  it("routes agriculture to MAFF + ASAT + MOJ", () => {
    expect(sourceAllowlistForIndustry("agriculture")).toEqual([
      "www.maff.go.jp",
      "asat-nca.jp",
      "www.moj.go.jp",
    ]);
  });

  it("routes construction to MLIT + JAC + MOJ", () => {
    expect(sourceAllowlistForIndustry("construction")).toEqual([
      "www.mlit.go.jp",
      "jac-skill.or.jp",
      "www.moj.go.jp",
    ]);
  });

  it("keeps nursing care on MHLW + MOJ", () => {
    expect(sourceAllowlistForIndustry("nursing_care")).toEqual(["www.mhlw.go.jp", "www.moj.go.jp"]);
  });

  it("routes legacy electronics alias to METI + SSWM + MOJ", () => {
    expect(sourceAllowlistForIndustry("electronics")).toEqual([
      "www.meti.go.jp",
      "www.sswm.go.jp",
      "www.moj.go.jp",
    ]);
  });

  it("routes fishery to JFA + exam provider + MAFF + MOJ", () => {
    expect(sourceAllowlistForIndustry("fishery")).toEqual([
      "www.jfa.maff.go.jp",
      "suisankai.or.jp",
      "www.maff.go.jp",
      "www.moj.go.jp",
    ]);
  });

  it("routes 2024 added forest and wood sectors to Forestry Agency sites", () => {
    expect(sourceAllowlistForIndustry("forestry")).toEqual([
      "www.rinya.maff.go.jp",
      "www.zenmori.org",
      "www.moj.go.jp",
    ]);
    expect(sourceAllowlistForIndustry("wood_products")).toEqual([
      "www.rinya.maff.go.jp",
      "www.zenmoku.jp",
      "www.moj.go.jp",
    ]);
  });

  it("falls back to all go.jp for unknown or omitted industries", () => {
    expect(sourceAllowlistForIndustry(undefined)).toEqual(["*.go.jp"]);
    expect(sourceAllowlistForIndustry("other")).toEqual(["*.go.jp"]);
  });
});

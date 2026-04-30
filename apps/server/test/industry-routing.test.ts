import { describe, expect, it } from "vitest";
import { sourceAllowlistForIndustry } from "../src/industry-routing.js";

describe("sourceAllowlistForIndustry", () => {
  it("routes agriculture to MAFF + MOJ only", () => {
    expect(sourceAllowlistForIndustry("agriculture")).toEqual(["www.maff.go.jp", "www.moj.go.jp"]);
  });

  it("routes construction to MLIT + MOJ only", () => {
    expect(sourceAllowlistForIndustry("construction")).toEqual(["www.mlit.go.jp", "www.moj.go.jp"]);
  });

  it("keeps nursing care on MHLW + MOJ", () => {
    expect(sourceAllowlistForIndustry("nursing_care")).toEqual(["www.mhlw.go.jp", "www.moj.go.jp"]);
  });

  it("routes legacy electronics alias to METI + MOJ", () => {
    expect(sourceAllowlistForIndustry("electronics")).toEqual(["www.meti.go.jp", "www.moj.go.jp"]);
  });

  it("falls back to all go.jp for unknown or omitted industries", () => {
    expect(sourceAllowlistForIndustry(undefined)).toEqual(["*.go.jp"]);
    expect(sourceAllowlistForIndustry("other")).toEqual(["*.go.jp"]);
  });
});

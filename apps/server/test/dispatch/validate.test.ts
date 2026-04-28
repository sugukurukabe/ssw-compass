/**
 * assertDispatchAllowed tests (ADR-017 / sprint-4-plan §4 B.5)
 */

import type { SswIndustry } from "@ssw/shared-types";
import { assertDispatchAllowed, DispatchNotAllowedError } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";

describe("assertDispatchAllowed (ADR-017)", () => {
  it("agriculture → passes", () => {
    expect(() => assertDispatchAllowed("agriculture")).not.toThrow();
  });

  it("fishery → passes", () => {
    expect(() => assertDispatchAllowed("fishery")).not.toThrow();
  });

  it("construction → DispatchNotAllowedError", () => {
    expect(() => assertDispatchAllowed("construction" as SswIndustry)).toThrow(
      DispatchNotAllowedError,
    );
  });

  it("manufacturing → DispatchNotAllowedError", () => {
    expect(() => assertDispatchAllowed("industrial_products_manufacturing" as SswIndustry)).toThrow(
      DispatchNotAllowedError,
    );
  });

  it("nursing_care → DispatchNotAllowedError", () => {
    expect(() => assertDispatchAllowed("nursing_care" as SswIndustry)).toThrow(
      DispatchNotAllowedError,
    );
  });

  it("error message includes moj.go.jp URL", () => {
    try {
      assertDispatchAllowed("construction" as SswIndustry);
    } catch (e) {
      expect(e).toBeInstanceOf(DispatchNotAllowedError);
      expect((e as DispatchNotAllowedError).message).toContain("moj.go.jp");
      expect((e as DispatchNotAllowedError).industry).toBe("construction");
    }
  });
});

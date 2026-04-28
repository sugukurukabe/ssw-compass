/**
 * validateToolAnnotations tests (ADR-014 §5)
 * 起動時 annotation バリデーションが L2/L3 mis-configuration を検出することを確認する。
 */

import type { SswCompassToolAnnotation } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import {
  ToolAnnotationConfigError,
  validateToolAnnotations,
} from "../../src/hitl/validate-annotations.js";

const BASE: SswCompassToolAnnotation = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  title: "test tool",
  legalLevel: "L1",
  requiresGyoseishoshiAuth: false,
  hitlControls: ["H07_PII_AUTO_MASKING"],
  tier: "free",
};

describe("validateToolAnnotations — valid configurations", () => {
  it("L0 free tool → passes", () => {
    expect(() =>
      validateToolAnnotations([
        { name: "search_visa", annotations: { ...BASE, legalLevel: "L0" } },
      ]),
    ).not.toThrow();
  });

  it("L1 free tool → passes", () => {
    expect(() => validateToolAnnotations([{ name: "classify", annotations: BASE }])).not.toThrow();
  });

  it("L2 pro tool with H01 + requiresGyoseishoshiAuth → passes", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "submit_approval",
          annotations: {
            ...BASE,
            legalLevel: "L2",
            requiresGyoseishoshiAuth: true,
            hitlControls: ["H01_DRAFT_LOCKGATE", "H04_AUDIT_LOG_7Y", "H07_PII_AUTO_MASKING"],
            tier: "pro",
          },
        },
      ]),
    ).not.toThrow();
  });
});

describe("validateToolAnnotations — invalid configurations → ToolAnnotationConfigError", () => {
  it("L2 without requiresGyoseishoshiAuth → error", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "bad_l2",
          annotations: {
            ...BASE,
            legalLevel: "L2",
            requiresGyoseishoshiAuth: false,
            hitlControls: ["H01_DRAFT_LOCKGATE"],
          },
        },
      ]),
    ).toThrow(ToolAnnotationConfigError);
  });

  it("L2 without H01_DRAFT_LOCKGATE → error", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "bad_l2_no_h01",
          annotations: {
            ...BASE,
            legalLevel: "L2",
            requiresGyoseishoshiAuth: true,
            hitlControls: ["H07_PII_AUTO_MASKING"],
          },
        },
      ]),
    ).toThrow(ToolAnnotationConfigError);
  });

  it("L3 without requiresGyoseishoshiAuth → error", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "bad_l3",
          annotations: {
            ...BASE,
            legalLevel: "L3",
            requiresGyoseishoshiAuth: false,
            hitlControls: ["H01_DRAFT_LOCKGATE"],
          },
        },
      ]),
    ).toThrow(ToolAnnotationConfigError);
  });

  it("pro tier without H04_AUDIT_LOG_7Y → error", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "bad_pro_no_h04",
          annotations: {
            ...BASE,
            legalLevel: "L2",
            requiresGyoseishoshiAuth: true,
            hitlControls: ["H01_DRAFT_LOCKGATE"],
            tier: "pro",
          },
        },
      ]),
    ).toThrow(ToolAnnotationConfigError);
  });

  it("L1 with requiresGyoseishoshiAuth=true → error (L0/L1 must not require gyoseishoshi)", () => {
    expect(() =>
      validateToolAnnotations([
        {
          name: "bad_l1_gyo",
          annotations: { ...BASE, legalLevel: "L1", requiresGyoseishoshiAuth: true },
        },
      ]),
    ).toThrow(ToolAnnotationConfigError);
  });

  it("error message includes tool name", () => {
    try {
      validateToolAnnotations([
        {
          name: "my_tool",
          annotations: {
            ...BASE,
            legalLevel: "L2",
            requiresGyoseishoshiAuth: false,
            hitlControls: ["H01_DRAFT_LOCKGATE"],
          },
        },
      ]);
    } catch (e) {
      expect(e).toBeInstanceOf(ToolAnnotationConfigError);
      expect((e as ToolAnnotationConfigError).toolName).toBe("my_tool");
    }
  });
});

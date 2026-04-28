/**
 * HITL H01 lockgate tests (ADR-014)
 * assertHitlGate と assertHitlGateRuntime の全パスを網羅する。
 */

import type { AuthContextType } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import {
  assertHitlGate,
  assertHitlGateRuntime,
  HitlGateError,
  LOCKGATE_MESSAGE_JA,
} from "../../src/hitl/lockgate.js";

const FREE_AUTH: AuthContextType = {
  user_id: "anon",
  tier: "free",
  gyoseishoshi_verified: false,
  auth_source: "anonymous",
  issued_at: 0,
};

const PRO_NO_GYO: AuthContextType = {
  user_id: "pro-1",
  tier: "pro",
  gyoseishoshi_verified: false,
  auth_source: "jwt",
  issued_at: 1000,
};

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo-1",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

const BIZ_GYO: AuthContextType = {
  user_id: "biz-1",
  tier: "business",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "大阪府 99999",
  auth_source: "jwt",
  issued_at: 1000,
};

describe("assertHitlGate — L0 / L1 (always pass)", () => {
  it("L0 with null auth → passes", () => {
    expect(() => assertHitlGate(null, "search_visa", "L0")).not.toThrow();
  });

  it("L0 with anonymous Free → passes", () => {
    expect(() => assertHitlGate(FREE_AUTH, "search_visa", "L0")).not.toThrow();
  });

  it("L1 with Free → passes", () => {
    expect(() => assertHitlGate(FREE_AUTH, "classify_procedure", "L1")).not.toThrow();
  });

  it("L1 with Pro+gyoseishoshi → passes", () => {
    expect(() => assertHitlGate(PRO_GYO, "list_visa_documents", "L1")).not.toThrow();
  });
});

describe("assertHitlGate — L2 / L3 (blocking)", () => {
  it("L2 with null auth → HitlGateError", () => {
    expect(() => assertHitlGate(null, "submit_approval", "L2")).toThrow(HitlGateError);
  });

  it("L2 with Free tier → HitlGateError with LOCKGATE_MESSAGE_JA", () => {
    expect(() => assertHitlGate(FREE_AUTH, "submit_approval", "L2")).toThrowError(
      LOCKGATE_MESSAGE_JA,
    );
  });

  it("L2 with Pro but gyoseishoshi_verified=false → HitlGateError", () => {
    expect(() => assertHitlGate(PRO_NO_GYO, "submit_approval", "L2")).toThrow(HitlGateError);
  });

  it("L2 with Pro + gyoseishoshi_verified=true → passes", () => {
    expect(() => assertHitlGate(PRO_GYO, "submit_approval", "L2")).not.toThrow();
  });

  it("L2 with Business + gyoseishoshi_verified=true → passes", () => {
    expect(() => assertHitlGate(BIZ_GYO, "submit_approval", "L2")).not.toThrow();
  });

  it("L3 with Free → HitlGateError", () => {
    expect(() => assertHitlGate(FREE_AUTH, "generate_draft", "L3")).toThrow(HitlGateError);
  });

  it("L3 with Pro + gyoseishoshi → passes", () => {
    expect(() => assertHitlGate(PRO_GYO, "generate_draft", "L3")).not.toThrow();
  });

  it("HitlGateError has correct controlId and statusCode", () => {
    try {
      assertHitlGate(FREE_AUTH, "submit_approval", "L2");
    } catch (e) {
      expect(e).toBeInstanceOf(HitlGateError);
      const err = e as HitlGateError;
      expect(err.controlId).toBe("H01_DRAFT_LOCKGATE");
      expect(err.statusCode).toBe(403);
    }
  });
});

describe("assertHitlGateRuntime — per-call escalation (ADR-014 §2)", () => {
  it("static=L1, runtime=L1 → uses L1 (Free passes)", () => {
    expect(() => assertHitlGateRuntime(FREE_AUTH, "list_visa_documents", "L1", "L1")).not.toThrow();
  });

  it("static=L1, runtime=L2 → escalates to L2, Free → HitlGateError", () => {
    expect(() => assertHitlGateRuntime(FREE_AUTH, "list_visa_documents", "L1", "L2")).toThrow(
      HitlGateError,
    );
  });

  it("static=L1, runtime=L2 → Pro+gyoseishoshi passes", () => {
    expect(() => assertHitlGateRuntime(PRO_GYO, "list_visa_documents", "L1", "L2")).not.toThrow();
  });

  it("static=L2, runtime=L1 → uses L2 (static floor wins), Free → reject", () => {
    expect(() => assertHitlGateRuntime(FREE_AUTH, "some_tool", "L2", "L1")).toThrow(HitlGateError);
  });
});

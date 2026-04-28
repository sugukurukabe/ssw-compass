/**
 * Audit writer tests (ADR-015)
 * emitAuditEvent と sha256Hex の動作を確認する。
 * fetchAuditEvents は Cloud Logging API に依存するため integration test (opt-in)。
 */

import { createHash } from "node:crypto";
import type { AuditEventType } from "@ssw/shared-types";
import { describe, expect, it, vi } from "vitest";
import { emitAuditEvent, sha256Hex } from "../../src/audit/writer.js";
import { logger } from "../../src/logger.js";

const SAMPLE_AUDIT_EVENT: AuditEventType = {
  timestamp: "2026-04-28T09:00:00Z",
  actor: {
    user_id_hash: "a".repeat(64),
    tier: "pro",
    gyoseishoshi_number: "東京都 12345",
  },
  action: "tool_invoked",
  case_id: "case_abcd1234efgh5678",
  tool_id: "search_visa",
  legal_level: "L0",
  input_hash: "b".repeat(64),
  output_hash: "c".repeat(64),
  schema_version: "v1",
};

describe("sha256Hex", () => {
  it("produces 64-char hex", () => {
    const h = sha256Hex({ query: "test" });
    expect(h).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(h)).toBe(true);
  });

  it("is deterministic", () => {
    const a = sha256Hex({ x: 1 });
    const b = sha256Hex({ x: 1 });
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    expect(sha256Hex({ x: 1 })).not.toBe(sha256Hex({ x: 2 }));
  });

  it("matches Node crypto createHash directly", () => {
    const val = { foo: "bar" };
    const expected = createHash("sha256").update(JSON.stringify(val)).digest("hex");
    expect(sha256Hex(val)).toBe(expected);
  });
});

describe("emitAuditEvent", () => {
  it("calls logger.info with event='audit_event'", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    expect(spy).toHaveBeenCalledOnce();
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(payload["event"]).toBe("audit_event");
    spy.mockRestore();
  });

  it("includes timestamp in log payload", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(payload["timestamp"]).toBe("2026-04-28T09:00:00Z");
    spy.mockRestore();
  });

  it("includes actor.tier in log payload", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    const actor = payload["actor"] as Record<string, unknown>;
    expect(actor["tier"]).toBe("pro");
    spy.mockRestore();
  });

  it("includes case_id in log payload", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(payload["case_id"]).toBe("case_abcd1234efgh5678");
    spy.mockRestore();
  });

  it("does NOT include content body — only hashes", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    // The event only has input_hash / output_hash, not raw content
    expect(payload["input_hash"]).toMatch(/^[a-f0-9]{64}$/);
    expect(payload["output_hash"]).toMatch(/^[a-f0-9]{64}$/);
    expect(payload["input_content"]).toBeUndefined();
    expect(payload["output_content"]).toBeUndefined();
    spy.mockRestore();
  });

  it("schema_version is v1", () => {
    const spy = vi.spyOn(logger, "info");
    emitAuditEvent(SAMPLE_AUDIT_EVENT);
    const [payload] = spy.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
    expect(payload["schema_version"]).toBe("v1");
    spy.mockRestore();
  });
});

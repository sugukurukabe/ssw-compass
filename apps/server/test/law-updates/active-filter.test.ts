/**
 * filterActiveLawUpdates / recomputeLawUpdateStatus テスト (sprint-4-plan §4 B.3)
 * JST timezone, status transitions, fixture contents を確認する。
 */

import type { LawUpdateType } from "@ssw/shared-types";
import { KNOWN_LAW_UPDATES_FIXTURE } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import {
  filterActiveLawUpdates,
  recomputeLawUpdateStatus,
} from "../../src/law-updates/active-filter.js";

// テスト用の最小 fixture ヘルパー
function makeEntry(overrides: Partial<LawUpdateType>): LawUpdateType {
  return {
    id: "FY2025-test",
    effective_date: "2025-01-01",
    announced_date: "2024-12-01",
    title_ja: "テスト",
    summary_ja: "テスト概要",
    category: "operational_guidance",
    affecting_roles: ["host_company_hr"],
    impact_severity: "info",
    source_urls: ["https://www.moj.go.jp/isa/"],
    status: "pending",
    ...overrides,
  };
}

const FUTURE_DATE = new Date("2099-01-01T00:00:00Z");
const PAST_DATE = new Date("2020-01-01T00:00:00Z");

describe("filterActiveLawUpdates — status transitions", () => {
  it("effective_date < today → status: active", () => {
    const fixture = [makeEntry({ effective_date: "2024-06-01", status: "pending" })];
    const result = filterActiveLawUpdates(fixture, new Date("2024-06-02T12:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("active");
  });

  it("effective_date === today → status: active (inclusive)", () => {
    const today = new Date("2026-01-01T15:00:00Z"); // JST 2026-01-02 0:00
    // JST midnight = 2026-01-01T15:00:00Z → effective 2026-01-01 is <= today
    const fixture = [makeEntry({ effective_date: "2026-01-01", status: "pending" })];
    const result = filterActiveLawUpdates(fixture, today);
    expect(result[0]?.status).toBe("active");
  });

  it("effective_date > today → excluded from result", () => {
    const fixture = [makeEntry({ effective_date: "2099-12-31", status: "pending" })];
    const result = filterActiveLawUpdates(fixture, PAST_DATE);
    expect(result).toHaveLength(0);
  });

  it("status: pending_verification → excluded regardless of date", () => {
    const fixture = [makeEntry({ effective_date: "2020-01-01", status: "pending_verification" })];
    const result = filterActiveLawUpdates(fixture, FUTURE_DATE);
    expect(result).toHaveLength(0);
  });

  it("status: withdrawn → excluded regardless of date", () => {
    const fixture = [makeEntry({ effective_date: "2020-01-01", status: "withdrawn" })];
    const result = filterActiveLawUpdates(fixture, FUTURE_DATE);
    expect(result).toHaveLength(0);
  });

  it("effective_date: TBD → pending_verification, excluded", () => {
    const fixture = [makeEntry({ effective_date: "TBD", status: "pending" })];
    const result = filterActiveLawUpdates(fixture, FUTURE_DATE);
    expect(result).toHaveLength(0);
  });
});

describe("recomputeLawUpdateStatus", () => {
  it("does not mutate the original fixture", () => {
    const fixture = [makeEntry({ effective_date: "2020-01-01", status: "pending" })];
    const original = fixture[0]?.status;
    recomputeLawUpdateStatus(fixture, FUTURE_DATE);
    expect(fixture[0]?.status).toBe(original);
  });

  it("withdrawn status is preserved", () => {
    const fixture = [makeEntry({ effective_date: "2020-01-01", status: "withdrawn" })];
    const result = recomputeLawUpdateStatus(fixture, FUTURE_DATE);
    expect(result[0]?.status).toBe("withdrawn");
  });
});

describe("KNOWN_LAW_UPDATES_FIXTURE — contents (sprint-4-plan §4 B.3)", () => {
  it("fixture has at least 4 entries", () => {
    expect(KNOWN_LAW_UPDATES_FIXTURE.length).toBeGreaterThanOrEqual(4);
  });

  it("all entries have source_urls with length >= 1", () => {
    for (const entry of KNOWN_LAW_UPDATES_FIXTURE) {
      expect(entry.source_urls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("critical entries include immigration_act", () => {
    const criticals = KNOWN_LAW_UPDATES_FIXTURE.filter((e) => e.impact_severity === "critical");
    const categories = criticals.map((e) => e.category);
    expect(categories).toContain("immigration_act");
  });
});

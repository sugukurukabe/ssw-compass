import type { DlpServiceClient } from "@google-cloud/dlp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setDlpClientForTesting } from "../../src/pii/dlp-client.js";
import { scrubInputForPII } from "../../src/pii/index.js";

/**
 * DLP 2nd stage behaviour tests — Sprint 3 Batch 5.
 *
 * Uses the __setDlpClientForTesting DI seam in dlp-client.ts to inject
 * a mocked DlpServiceClient whose inspectContent can be configured
 * per test to return findings, return clean, or throw an error
 * (fail-closed path). No real DLP API calls are made.
 *
 * Regex-stage-only tests remain in scrub.test.ts (unaffected by this
 * file). This file owns the DLP_ENABLED=true branch coverage.
 */

const DLP_ENV_KEYS = ["DLP_ENABLED", "CLOUDSDK_CORE_PROJECT"] as const;

function clearDlpEnv(): void {
  for (const key of DLP_ENV_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearDlpEnv();
  __setDlpClientForTesting(null);
});

afterEach(() => {
  clearDlpEnv();
  __setDlpClientForTesting(null);
});

function makeMockClient(inspectImpl: (req: unknown) => unknown): DlpServiceClient {
  return { inspectContent: vi.fn(inspectImpl) } as unknown as DlpServiceClient;
}

describe("scrubInputForPII — DLP disabled (regex-only)", () => {
  it("returns unblocked for clean input when DLP_ENABLED is unset", async () => {
    const result = await scrubInputForPII({ query: "特定技能1号 建設分野" });
    expect(result).toEqual({ blocked: false, types: [] });
  });

  it("regex stage short-circuits before DLP is reached", async () => {
    process.env["DLP_ENABLED"] = "true";
    process.env["CLOUDSDK_CORE_PROJECT"] = "ssw-compass-prod-494613";
    const mockInspect = vi.fn();
    __setDlpClientForTesting(makeMockClient(mockInspect));

    const result = await scrubInputForPII({
      query: "AB12345678CD を持って申請",
    });

    expect(result.blocked).toBe(true);
    expect(result.types).toContain("ZAIRYU_CARD_NUMBER");
    expect(mockInspect).not.toHaveBeenCalled();
  });
});

describe("scrubInputForPII — DLP enabled branch", () => {
  beforeEach(() => {
    process.env["DLP_ENABLED"] = "true";
    process.env["CLOUDSDK_CORE_PROJECT"] = "ssw-compass-prod-494613";
  });

  it("blocks when DLP returns findings (EMAIL_ADDRESS)", async () => {
    __setDlpClientForTesting(
      makeMockClient(async () => [
        {
          result: {
            findings: [{ infoType: { name: "EMAIL_ADDRESS" } }],
          },
        },
      ]),
    );

    const result = await scrubInputForPII({ query: "お問い合わせ user-dummy@test.example" });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("EMAIL_ADDRESS");
  });

  it("passes through when DLP returns zero findings", async () => {
    __setDlpClientForTesting(makeMockClient(async () => [{ result: { findings: [] } }]));

    const result = await scrubInputForPII({ query: "特定技能1号 更新手続" });
    expect(result.blocked).toBe(false);
    expect(result.types).toEqual([]);
  });

  it("fail-closed when DLP throws — returns blocked + DLP_API_ERROR", async () => {
    __setDlpClientForTesting(
      makeMockClient(async () => {
        throw Object.assign(new Error("PERMISSION_DENIED"), { code: "7" });
      }),
    );

    const result = await scrubInputForPII({ query: "普通の質問" });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("DLP_API_ERROR");
  });

  it("fail-closed when DLP times out", async () => {
    __setDlpClientForTesting(
      makeMockClient(
        () => new Promise(() => {}), // never resolves → triggers 3s timeout
      ),
    );

    const result = await scrubInputForPII({ query: "タイムアウト検証" });
    expect(result.blocked).toBe(true);
    expect(result.types).toContain("DLP_API_ERROR");
  }, 10_000);

  it("throws when DLP_ENABLED but no project resolvable", async () => {
    delete process.env["CLOUDSDK_CORE_PROJECT"];
    delete process.env["SSW_VERTEX_PROJECT"];
    delete process.env["GOOGLE_CLOUD_PROJECT"];

    await expect(scrubInputForPII({ query: "q" })).rejects.toThrow(/DLP_ENABLED=true requires/);
  });
});

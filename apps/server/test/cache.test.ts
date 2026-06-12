import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { CACHE_TIERS, lawUpdatesCacheGeneration, withCacheMeta } from "../src/cache.js";

describe("cache metadata helpers", () => {
  it("preserves existing _meta while adding cache fields", () => {
    const result: CallToolResult = {
      content: [{ type: "text", text: "ok" }],
      _meta: { progressToken: "progress-1" },
    };

    expect(withCacheMeta(result, CACHE_TIERS.A_PUBLIC_DAY)._meta).toEqual({
      progressToken: "progress-1",
      ttlMs: 86_400_000,
      cacheScope: "public",
    });
  });

  it("creates deterministic law update cache generations", () => {
    expect(lawUpdatesCacheGeneration("2026-05-29")).toBe("law-updates-2026-05-29");
  });
});

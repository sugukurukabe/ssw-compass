/**
 * search_visa handler — disclaimer presence on the empty-result path.
 * 空結果でも免責が含まれることを保証する (.cursor/rules/tools.mdc).
 * Guarantees the disclaimer is present even when no results are found.
 * Memastikan penafian tetap ada meskipun tidak ada hasil yang ditemukan.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG } from "@ssw/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchVisa } from "../../../src/tools/search-visa/handler.js";
import { __setSearchClientForTesting, type SearchClientLike } from "../../../src/vertex.js";

const REAL_ENV: Record<string, string> = {
  SSW_VERTEX_MODE: "real",
  SSW_VERTEX_PROJECT: "ssw-test-proj",
  SSW_VERTEX_LOCATION: "asia-northeast1",
  SSW_VERTEX_COLLECTION: "default_collection",
  SSW_VERTEX_DATA_STORE_ID: "visa_legal",
  SSW_VERTEX_SERVING_CONFIG_ID: "default_serving_config",
};

function emptyClient(): SearchClientLike {
  return {
    projectLocationCollectionDataStoreServingConfigPath: vi.fn(() => "dummy-path"),
    search: vi.fn().mockResolvedValue([[], {}, {}]),
  };
}

function firstText(result: CallToolResult): string {
  const block = result.content[0];
  return block !== undefined && block.type === "text" ? block.text : "";
}

beforeEach(() => {
  for (const [key, value] of Object.entries(REAL_ENV)) {
    process.env[key] = value;
  }
  __setSearchClientForTesting(emptyClient());
});

afterEach(() => {
  for (const key of Object.keys(REAL_ENV)) {
    delete process.env[key];
  }
  __setSearchClientForTesting(null);
});

describe("searchVisa — empty result disclaimer", () => {
  it("includes the ja disclaimer when no official sources are found", async () => {
    const result = await searchVisa({ category: "tokutei_ginou_1", language: "ja" });
    const text = firstText(result);
    expect(text).toContain("見つかりませんでした");
    expect(text).toContain(DISCLAIMER_BY_LANG.ja);
  });

  it("includes the en disclaimer for an English empty-result response", async () => {
    const result = await searchVisa({ category: "tokutei_ginou_1", language: "en" });
    const text = firstText(result);
    expect(text).toContain(DISCLAIMER_BY_LANG.en);
  });
});

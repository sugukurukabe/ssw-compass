import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __setSearchClientForTesting,
  type SearchClientLike,
  type VertexSearchArgs,
  vertexSearch,
} from "../src/vertex.js";

/**
 * vertex.ts dispatcher tests — covers fixture default, explicit fixture mode,
 * real-mode env-missing throw, and real-mode mapping (including source
 * allowlist drop). See ADR-006 for the dispatch contract.
 */

const BASE_ARGS: VertexSearchArgs = {
  query: "tokutei_ginou_1 agriculture 2026-09",
  datastore: "visa_legal",
  confidenceThreshold: 0.7,
  sourceAllowlist: ["*.go.jp"],
};

const VCJ_ENV_KEYS = [
  "VCJ_VERTEX_MODE",
  "VCJ_VERTEX_PROJECT",
  "VCJ_VERTEX_LOCATION",
  "VCJ_VERTEX_COLLECTION",
  "VCJ_VERTEX_DATA_STORE_ID",
  "VCJ_VERTEX_SERVING_CONFIG_ID",
] as const;

function clearVcjEnv(): void {
  for (const key of VCJ_ENV_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearVcjEnv();
  __setSearchClientForTesting(null);
});

afterEach(() => {
  clearVcjEnv();
  __setSearchClientForTesting(null);
});

describe("vertexSearch — fixture mode (default)", () => {
  it("returns 2 MOJ fixture chunks when VCJ_VERTEX_MODE is unset", async () => {
    const result = await vertexSearch(BASE_ARGS);
    expect(result.chunks.length).toBe(2);
    expect(result.chunks[0]?.uri).toMatch(/^https:\/\/www\.moj\.go\.jp\/isa\//);
    expect(result.chunks.every((c) => c.confidence === 0.9)).toBe(true);
  });

  it("explicit VCJ_VERTEX_MODE=fixture keeps the fixture behaviour", async () => {
    process.env["VCJ_VERTEX_MODE"] = "fixture";
    const result = await vertexSearch(BASE_ARGS);
    expect(result.chunks.length).toBe(2);
  });
});

describe("vertexSearch — real mode", () => {
  it("throws a clear error listing the missing env vars", async () => {
    process.env["VCJ_VERTEX_MODE"] = "real";
    await expect(vertexSearch(BASE_ARGS)).rejects.toThrow(
      /VCJ_VERTEX_MODE=real requires env vars:.*VCJ_VERTEX_PROJECT.*VCJ_VERTEX_LOCATION.*VCJ_VERTEX_COLLECTION.*VCJ_VERTEX_DATA_STORE_ID.*VCJ_VERTEX_SERVING_CONFIG_ID/s,
    );
  });

  it("calls search() with the composed servingConfig path and returns mapped chunks", async () => {
    process.env["VCJ_VERTEX_MODE"] = "real";
    process.env["VCJ_VERTEX_PROJECT"] = "vcj-test-proj";
    process.env["VCJ_VERTEX_LOCATION"] = "asia-northeast1";
    process.env["VCJ_VERTEX_COLLECTION"] = "default_collection";
    process.env["VCJ_VERTEX_DATA_STORE_ID"] = "visa_legal";
    process.env["VCJ_VERTEX_SERVING_CONFIG_ID"] = "default_serving_config";

    const mockClient: SearchClientLike = {
      projectLocationCollectionDataStoreServingConfigPath: vi.fn(
        (project, location, collection, dataStore, servingConfig) =>
          `projects/${project}/locations/${location}/collections/${collection}/dataStores/${dataStore}/servingConfigs/${servingConfig}`,
      ),
      search: vi.fn().mockResolvedValue([
        [
          {
            document: {
              id: "moj-test-1",
              derivedStructData: {
                fields: {
                  link: {
                    stringValue: "https://www.moj.go.jp/isa/applications/procedures/test-1.html",
                  },
                  title: { stringValue: "テスト文書 1" },
                  snippet: { stringValue: "一次情報のテスト抜粋。" },
                },
              },
              structData: { fields: { publishedAt: { stringValue: "2026-03-10" } } },
            },
          },
        ],
        {},
        {},
      ]),
    };
    __setSearchClientForTesting(mockClient);

    const result = await vertexSearch(BASE_ARGS);

    expect(mockClient.projectLocationCollectionDataStoreServingConfigPath).toHaveBeenCalledWith(
      "vcj-test-proj",
      "asia-northeast1",
      "default_collection",
      "visa_legal",
      "default_serving_config",
    );
    expect(mockClient.search).toHaveBeenCalledTimes(1);
    const callArg = (mockClient.search as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg?.servingConfig).toBe(
      "projects/vcj-test-proj/locations/asia-northeast1/collections/default_collection/dataStores/visa_legal/servingConfigs/default_serving_config",
    );
    expect(callArg?.query).toBe(BASE_ARGS.query);

    expect(result.chunks.length).toBe(1);
    const chunk = result.chunks[0];
    expect(chunk?.uri).toBe("https://www.moj.go.jp/isa/applications/procedures/test-1.html");
    expect(chunk?.title).toBe("テスト文書 1");
    expect(chunk?.docId).toBe("moj-test-1");
    expect(chunk?.publishedAt).toBe("2026-03-10");
    expect(chunk?.confidence).toBe(0.9);
  });

  it("drops results whose link falls outside the *.go.jp allowlist", async () => {
    process.env["VCJ_VERTEX_MODE"] = "real";
    process.env["VCJ_VERTEX_PROJECT"] = "vcj-test-proj";
    process.env["VCJ_VERTEX_LOCATION"] = "asia-northeast1";
    process.env["VCJ_VERTEX_COLLECTION"] = "default_collection";
    process.env["VCJ_VERTEX_DATA_STORE_ID"] = "visa_legal";
    process.env["VCJ_VERTEX_SERVING_CONFIG_ID"] = "default_serving_config";

    const mockClient: SearchClientLike = {
      projectLocationCollectionDataStoreServingConfigPath: vi.fn(() => "dummy-path"),
      search: vi.fn().mockResolvedValue([
        [
          {
            document: {
              id: "good",
              derivedStructData: {
                fields: {
                  link: { stringValue: "https://www.moj.go.jp/isa/ok.html" },
                  title: { stringValue: "allowed" },
                },
              },
              structData: { fields: {} },
            },
          },
          {
            document: {
              id: "bad",
              derivedStructData: {
                fields: {
                  link: { stringValue: "https://example.com/not-allowed.html" },
                  title: { stringValue: "not allowed" },
                },
              },
              structData: { fields: {} },
            },
          },
        ],
        {},
        {},
      ]),
    };
    __setSearchClientForTesting(mockClient);

    const result = await vertexSearch(BASE_ARGS);
    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0]?.docId).toBe("good");
  });

  it("skips results whose document payload has no usable link field", async () => {
    process.env["VCJ_VERTEX_MODE"] = "real";
    process.env["VCJ_VERTEX_PROJECT"] = "vcj-test-proj";
    process.env["VCJ_VERTEX_LOCATION"] = "asia-northeast1";
    process.env["VCJ_VERTEX_COLLECTION"] = "default_collection";
    process.env["VCJ_VERTEX_DATA_STORE_ID"] = "visa_legal";
    process.env["VCJ_VERTEX_SERVING_CONFIG_ID"] = "default_serving_config";

    const mockClient: SearchClientLike = {
      projectLocationCollectionDataStoreServingConfigPath: vi.fn(() => "dummy-path"),
      search: vi.fn().mockResolvedValue([
        [
          {
            document: {
              id: "no-link",
              derivedStructData: { fields: {} },
              structData: { fields: {} },
            },
          },
          {
            document: {
              id: "has-link",
              derivedStructData: {
                fields: {
                  link: { stringValue: "https://www.moj.go.jp/isa/ok2.html" },
                },
              },
              structData: { fields: {} },
            },
          },
        ],
        {},
        {},
      ]),
    };
    __setSearchClientForTesting(mockClient);

    const result = await vertexSearch(BASE_ARGS);
    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0]?.docId).toBe("has-link");
  });
});

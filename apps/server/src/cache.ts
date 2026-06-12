/**
 * MCP レスポンスのキャッシュ metadata を付与する
 * Attach cache metadata to MCP responses
 * Menambahkan metadata cache ke respons MCP
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type CacheScope = "public" | "private";

export type CacheMetadata = {
  ttlMs: number;
  cacheScope: CacheScope;
  cacheGeneration?: string;
};

export const CACHE_TIERS = {
  A_PUBLIC_DAY: { ttlMs: 86_400_000, cacheScope: "public" },
  B_PUBLIC_HOUR: { ttlMs: 3_600_000, cacheScope: "public" },
  C_PRIVATE_NO_STORE: { ttlMs: 0, cacheScope: "private" },
} as const satisfies Record<string, CacheMetadata>;

export function withCacheMeta<T extends CallToolResult>(result: T, metadata: CacheMetadata): T {
  return {
    ...result,
    _meta: {
      ...(result._meta ?? {}),
      ttlMs: metadata.ttlMs,
      cacheScope: metadata.cacheScope,
      ...(metadata.cacheGeneration === undefined
        ? {}
        : { cacheGeneration: metadata.cacheGeneration }),
    },
  };
}

export function lawUpdatesCacheGeneration(datasetReviewedDate: string): string {
  return `law-updates-${datasetReviewedDate}`;
}

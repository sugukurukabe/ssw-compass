import { SearchServiceClient } from "@google-cloud/discoveryengine";

/**
 * Vertex AI Search client — Sprint 2 Batch 4.
 *
 * Two modes dispatched by the `SSW_VERTEX_MODE` env var:
 * - "fixture" (default): returns hardcoded primary_source entries from
 *   moj.go.jp/isa so the tool pipeline is fully testable without GCP
 *   credentials. Used on localhost and in CI.
 * - "real": calls Vertex AI Search (`@google-cloud/discoveryengine`
 *   SearchServiceClient) against the configured data store. Required
 *   env: SSW_VERTEX_PROJECT / SSW_VERTEX_LOCATION / SSW_VERTEX_COLLECTION
 *   / SSW_VERTEX_DATA_STORE_ID / SSW_VERTEX_SERVING_CONFIG_ID. Missing
 *   any one throws immediately (silent fallback to fixture is rejected
 *   for auditability).
 *
 * Confidence scoring is fixed at 0.9 for both modes in Sprint 2. Real
 * data-store-side relevance tuning lands in Sprint 3 together with v3
 * §23.2 egress controls (VPC connector + Cloud NAT + safeFetch).
 *
 * The `VertexSearchArgs` / `VertexSearchResult` / `GroundedChunk` contract
 * is frozen — handler sites (search-visa, classify-procedure,
 * get-deadline-timeline) do not change when the dispatcher flips to real.
 *
 * See ADR-006 for the full rationale.
 */

export interface VertexSearchArgs {
  query: string;
  datastore: string;
  confidenceThreshold: number;
  sourceAllowlist: readonly string[];
}

export interface GroundedChunk {
  title: string;
  snippet: string;
  uri: string;
  confidence: number;
  publishedAt: string;
  docId: string;
}

export interface VertexSearchResult {
  chunks: GroundedChunk[];
}

type VertexMode = "fixture" | "real";

const FIXTURE_CHUNKS: readonly GroundedChunk[] = [
  {
    title: "特定技能1号 — 在留資格変更許可申請の手引き",
    snippet:
      "特定技能1号への在留資格変更を希望する場合、所属機関との雇用契約、" +
      "技能試験・日本語試験の合格証、支援計画書等の添付が必要です。" +
      "処理期間の目安は標準で1〜3ヶ月です。",
    uri: "https://www.moj.go.jp/isa/applications/procedures/nyuukokukanri07_00201.html",
    confidence: 0.9,
    publishedAt: "2026-01-15",
    docId: "moj-isa-tg1-henkou-tebiki-2026-01",
  },
  {
    title: "特定技能制度の対象分野と必要書類",
    snippet:
      "特定技能1号の対象分野は現在12分野。分野ごとに所管省庁が定める" +
      "運用要領に従い必要書類を整える必要があります。" +
      "農業分野では農林水産省所管の運用要領を参照してください。",
    uri: "https://www.moj.go.jp/isa/policies/policies/ssw/index.html",
    confidence: 0.9,
    publishedAt: "2026-02-20",
    docId: "moj-isa-ssw-overview-2026-02",
  },
];

function resolveMode(): VertexMode {
  const raw = process.env["SSW_VERTEX_MODE"];
  return raw === "real" ? "real" : "fixture";
}

interface RealSearchConfig {
  project: string;
  location: string;
  collection: string;
  dataStore: string;
  servingConfig: string;
}

function resolveRealConfig(): RealSearchConfig {
  const project = process.env["SSW_VERTEX_PROJECT"];
  const location = process.env["SSW_VERTEX_LOCATION"];
  const collection = process.env["SSW_VERTEX_COLLECTION"];
  const dataStore = process.env["SSW_VERTEX_DATA_STORE_ID"];
  const servingConfig = process.env["SSW_VERTEX_SERVING_CONFIG_ID"];
  const missing: string[] = [];
  if (project === undefined || project.length === 0) missing.push("SSW_VERTEX_PROJECT");
  if (location === undefined || location.length === 0) missing.push("SSW_VERTEX_LOCATION");
  if (collection === undefined || collection.length === 0) missing.push("SSW_VERTEX_COLLECTION");
  if (dataStore === undefined || dataStore.length === 0) missing.push("SSW_VERTEX_DATA_STORE_ID");
  if (servingConfig === undefined || servingConfig.length === 0) {
    missing.push("SSW_VERTEX_SERVING_CONFIG_ID");
  }
  if (missing.length > 0) {
    throw new Error(
      `SSW_VERTEX_MODE=real requires env vars: ${missing.join(", ")}. ` +
        "Set them or switch back to SSW_VERTEX_MODE=fixture for local development.",
    );
  }
  // biome-ignore lint/style/noNonNullAssertion: the missing-guard above is exhaustive
  return {
    project: project as string,
    location: location as string,
    collection: collection as string,
    dataStore: dataStore as string,
    servingConfig: servingConfig as string,
  };
}

async function fixtureSearch(args: VertexSearchArgs): Promise<VertexSearchResult> {
  void args;
  const chunks = FIXTURE_CHUNKS.filter((c) => c.confidence >= 0.7);
  return { chunks };
}

/**
 * Extract a nested `stringValue` from a protobuf Struct-shaped object.
 * Returns undefined when any hop is missing or not a string value.
 *
 * Protobuf JSON shape: { fields: { [key]: { stringValue | numberValue | ... } } }
 */
function getStringField(
  struct: { fields?: { [k: string]: unknown } | null | undefined } | null | undefined,
  key: string,
): string | undefined {
  const fields = struct?.fields;
  if (fields === undefined || fields === null) return undefined;
  const value = fields[key];
  if (value === undefined || value === null || typeof value !== "object") return undefined;
  const maybeString = (value as { stringValue?: unknown }).stringValue;
  return typeof maybeString === "string" ? maybeString : undefined;
}

function isAllowedUri(uri: string, sourceAllowlist: readonly string[]): boolean {
  if (sourceAllowlist.length === 0) return true;
  let host: string;
  try {
    host = new URL(uri).hostname;
  } catch {
    return false;
  }
  return sourceAllowlist.some((pattern) => matchHostPattern(host, pattern));
}

function matchHostPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) || host === suffix.slice(1);
  }
  return host === pattern;
}

type SearchResultDoc = {
  id?: string | null;
  derivedStructData?: { fields?: { [k: string]: unknown } | null } | null;
  structData?: { fields?: { [k: string]: unknown } | null } | null;
};
type SearchResult = { document?: SearchResultDoc | null };

function resultToChunk(result: SearchResult): GroundedChunk | null {
  const doc = result.document;
  if (doc === undefined || doc === null) return null;
  const derived = doc.derivedStructData ?? undefined;
  const struct = doc.structData ?? undefined;

  const link = getStringField(derived, "link") ?? getStringField(struct, "uri");
  if (link === undefined) return null;

  const title = getStringField(derived, "title") ?? getStringField(struct, "title") ?? "(no title)";
  const snippet = getStringField(derived, "snippet") ?? getStringField(struct, "snippet") ?? "";
  const publishedAt = getStringField(struct, "publishedAt") ?? "unknown";
  const docId = doc.id ?? "unknown";

  return {
    title,
    snippet,
    uri: link,
    confidence: 0.9,
    publishedAt,
    docId,
  };
}

/**
 * Minimal structural contract of the bits of SearchServiceClient we call.
 * Exposed so tests can inject a typed mock via __setSearchClientForTesting
 * without pulling in the full proto shape.
 */
export interface SearchClientLike {
  projectLocationCollectionDataStoreServingConfigPath(
    project: string,
    location: string,
    collection: string,
    dataStore: string,
    servingConfig: string,
  ): string;
  search(request: {
    servingConfig: string;
    query: string;
    pageSize?: number;
  }): Promise<[readonly SearchResult[], unknown, unknown]>;
}

let _client: SearchClientLike | null = null;

function getSearchClient(): SearchClientLike {
  if (_client !== null) return _client;
  _client = new SearchServiceClient() as unknown as SearchClientLike;
  return _client;
}

/**
 * Testing seam — allows vitest to inject a mocked SearchServiceClient
 * (or `null` to clear between tests). Production code paths never call this.
 */
export function __setSearchClientForTesting(client: SearchClientLike | null): void {
  _client = client;
}

async function realSearch(
  args: VertexSearchArgs,
  client: SearchClientLike,
  config: RealSearchConfig,
): Promise<VertexSearchResult> {
  const servingConfigPath = client.projectLocationCollectionDataStoreServingConfigPath(
    config.project,
    config.location,
    config.collection,
    config.dataStore,
    config.servingConfig,
  );
  const [results] = await client.search({
    servingConfig: servingConfigPath,
    query: args.query,
    pageSize: 10,
  });
  const chunks: GroundedChunk[] = [];
  for (const r of results) {
    const chunk = resultToChunk(r);
    if (chunk === null) continue;
    if (!isAllowedUri(chunk.uri, args.sourceAllowlist)) continue;
    chunks.push(chunk);
  }
  return { chunks };
}

export async function vertexSearch(args: VertexSearchArgs): Promise<VertexSearchResult> {
  const mode = resolveMode();
  if (mode === "fixture") {
    return fixtureSearch(args);
  }
  const config = resolveRealConfig();
  const client = getSearchClient();
  return realSearch(args, client, config);
}

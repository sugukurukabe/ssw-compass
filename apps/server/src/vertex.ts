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
 * Confidence scoring is **currently fixed at 0.9 for both modes** as a
 * Sprint 2 carry-over. This means `args.confidenceThreshold` (the
 * handler-site >= 0.7 guard) is satisfied trivially in real mode today,
 * and fine-grained ranking from Vertex is not yet honoured.
 * Sprint 4 Phase 1.4 replaces this with a real mapping from Vertex
 * `modelScores` (see docs/sprint-4-pending.md) and makes the threshold
 * meaningful end-to-end. Until that lands, do NOT rely on confidence
 * in real mode for filtering business logic beyond the handler-level
 * `>= 0.7` smoke check.
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
  preferredMinistries?: readonly string[];
  preferredTags?: readonly string[];
  dataStoreGroup?: string;
  maxChunks?: number;
}

export interface GroundedChunk {
  title: string;
  snippet: string;
  uri: string;
  confidence: number;
  publishedAt: string;
  docId: string;
  canonicalUrl?: string;
  ministry?: string;
  tags?: readonly string[];
  dataStoreGroup?: string;
  sourceType?: string;
}

export interface VertexSearchResult {
  chunks: GroundedChunk[];
}

type VertexMode = "fixture" | "real";

const INDUSTRY_TITLE_TERMS_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  agriculture: ["農業"],
  fishery: ["漁業"],
  food_manufacturing: ["飲食料品製造業"],
  food_service: ["外食業"],
  manufacturing: ["工業製品製造業", "素形材", "産業機械", "電気・電子情報関連"],
  industrial_products_manufacturing: ["工業製品製造業", "素形材", "産業機械", "電気・電子情報関連"],
  electronics: ["工業製品製造業", "電気・電子情報関連", "電子電気"],
  construction: ["建設"],
  nursing_care: ["介護"],
  building_cleaning: ["ビルクリーニング"],
  automobile_repair: ["自動車整備"],
  automobile_maintenance: ["自動車整備"],
  aviation: ["航空"],
  lodging: ["宿泊"],
  accommodation: ["宿泊"],
  shipbuilding: ["造船", "舶用工業"],
  automobile_transportation: ["自動車運送業"],
  railway: ["鉄道"],
  forestry: ["林業"],
  wood_products: ["木材産業"],
};

const BROAD_ROUTING_TAGS = new Set(["ssw_1", "procedure"]);
const FIELD_SPECIFIC_SOURCE_TYPES = new Set(["operation_guide", "operation_policy"]);
const INDUSTRY_SPECIFIC_TAGS = new Set(
  Object.keys(INDUSTRY_TITLE_TERMS_BY_TAG).filter((tag) => !BROAD_ROUTING_TAGS.has(tag)),
);

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
  const direct = (struct as unknown as Record<string, unknown> | null | undefined)?.[key];
  if (typeof direct === "string") return direct;
  const rawFields = (struct as unknown as { fields?: unknown } | null | undefined)?.fields;
  const fields =
    rawFields instanceof Map
      ? Object.fromEntries(rawFields.entries())
      : (rawFields as { [k: string]: unknown } | null | undefined);
  if (fields === undefined || fields === null) return undefined;
  const value = fields[key];
  if (typeof value === "string") return value;
  if (value === undefined || value === null || typeof value !== "object") return undefined;
  const maybeString = (value as { stringValue?: unknown }).stringValue;
  if (typeof maybeString === "string") return maybeString;
  const maybeSnakeString = (value as { string_value?: unknown }).string_value;
  return typeof maybeSnakeString === "string" ? maybeSnakeString : undefined;
}

function getStringListField(
  struct: { fields?: { [k: string]: unknown } | null | undefined } | null | undefined,
  key: string,
): string[] {
  const direct = (struct as unknown as Record<string, unknown> | null | undefined)?.[key];
  if (Array.isArray(direct)) {
    return direct.filter((item): item is string => typeof item === "string");
  }
  const rawFields = (struct as unknown as { fields?: unknown } | null | undefined)?.fields;
  const fields =
    rawFields instanceof Map
      ? Object.fromEntries(rawFields.entries())
      : (rawFields as { [k: string]: unknown } | null | undefined);
  if (fields === undefined || fields === null) return [];
  const value = fields[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (value === undefined || value === null || typeof value !== "object") return [];
  const list = (value as { listValue?: { values?: unknown[] } }).listValue?.values;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") return item;
      if (item === null || typeof item !== "object") return undefined;
      const stringValue = (item as { stringValue?: unknown }).stringValue;
      if (typeof stringValue === "string") return stringValue;
      const snakeStringValue = (item as { string_value?: unknown }).string_value;
      return typeof snakeStringValue === "string" ? snakeStringValue : undefined;
    })
    .filter((item): item is string => typeof item === "string");
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

function discoveryEngineApiEndpoint(location: string): string {
  return location === "global"
    ? "discoveryengine.googleapis.com"
    : `${location}-discoveryengine.googleapis.com`;
}

function resultToChunk(result: SearchResult): GroundedChunk | null {
  const doc = result.document;
  if (doc === undefined || doc === null) return null;
  const derived = doc.derivedStructData ?? undefined;
  const struct = doc.structData ?? undefined;

  const link =
    getStringField(struct, "canonicalUrl") ??
    getStringField(struct, "url") ??
    getStringField(struct, "uri") ??
    // GCS-backed Agent Search imports expose derivedStructData.link as the
    // gs:// object URI. Use it only as a last resort; user-facing source URLs
    // and host allowlisting must prefer official canonical URLs from structData.
    getStringField(derived, "link");
  if (link === undefined) return null;

  const title = getStringField(derived, "title") ?? getStringField(struct, "title") ?? "(no title)";
  const snippet = getStringField(derived, "snippet") ?? getStringField(struct, "snippet") ?? "";
  const publishedAt = getStringField(struct, "publishedAt") ?? "unknown";
  const docId = doc.id ?? "unknown";
  const canonicalUrl = getStringField(struct, "canonicalUrl");
  const ministry = getStringField(struct, "ministry");
  const tags = getStringListField(struct, "tags");
  const dataStoreGroup = getStringField(struct, "dataStoreGroup");
  const sourceType = getStringField(struct, "sourceType");

  return {
    title,
    snippet,
    uri: link,
    // Placeholder — Sprint 4 Phase 1.4 will replace this with a
    // mapping from Vertex `modelScores` so `confidenceThreshold`
    // actually filters low-relevance results in real mode. See the
    // top-of-file docstring for the migration plan.
    confidence: 0.9,
    publishedAt,
    docId,
    ...(canonicalUrl !== undefined ? { canonicalUrl } : {}),
    ...(ministry !== undefined ? { ministry } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(dataStoreGroup !== undefined ? { dataStoreGroup } : {}),
    ...(sourceType !== undefined ? { sourceType } : {}),
  };
}

function routingScore(chunk: GroundedChunk, args: VertexSearchArgs): number {
  let score = 0;
  if (hasPreferredTitleTerm(chunk.title, args.preferredTags ?? [])) score += 100;
  if (hasConflictingTitleTerm(chunk.title, args.preferredTags ?? [])) score -= 80;
  if (args.preferredMinistries?.includes(chunk.ministry ?? "") === true) score += 50;
  if (args.dataStoreGroup !== undefined && chunk.dataStoreGroup === args.dataStoreGroup)
    score += 15;
  const tags = chunk.tags ?? [];
  for (const tag of args.preferredTags ?? []) {
    if (!tags.includes(tag)) continue;
    score += BROAD_ROUTING_TAGS.has(tag) ? 10 : 50;
  }
  if (hasConflictingIndustryTag(tags, args.preferredTags ?? [])) score -= 80;
  if (FIELD_SPECIFIC_SOURCE_TYPES.has(chunk.sourceType ?? "")) score += 30;
  if (chunk.confidence >= args.confidenceThreshold) score += chunk.confidence;
  return score;
}

function hasPreferredTitleTerm(title: string, preferredTags: readonly string[]): boolean {
  for (const tag of preferredTags) {
    if (BROAD_ROUTING_TAGS.has(tag)) continue;
    const terms = INDUSTRY_TITLE_TERMS_BY_TAG[tag];
    if (terms?.some((term) => title.includes(term)) === true) return true;
  }
  return false;
}

function hasConflictingTitleTerm(title: string, preferredTags: readonly string[]): boolean {
  const preferred = new Set(preferredTags.filter((tag) => !BROAD_ROUTING_TAGS.has(tag)));
  if (preferred.size === 0) return false;
  for (const [tag, terms] of Object.entries(INDUSTRY_TITLE_TERMS_BY_TAG)) {
    if (preferred.has(tag)) continue;
    if (terms.some((term) => title.includes(term))) return true;
  }
  return false;
}

function hasConflictingIndustryTag(
  tags: readonly string[],
  preferredTags: readonly string[],
): boolean {
  const preferred = new Set(preferredTags.filter((tag) => !BROAD_ROUTING_TAGS.has(tag)));
  if (preferred.size === 0) return false;
  return tags.some((tag) => INDUSTRY_SPECIFIC_TAGS.has(tag) && !preferred.has(tag));
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
  const location = process.env["SSW_VERTEX_LOCATION"] ?? "global";
  _client = new SearchServiceClient({
    apiEndpoint: discoveryEngineApiEndpoint(location),
  }) as unknown as SearchClientLike;
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
  chunks.sort((a, b) => routingScore(b, args) - routingScore(a, args));
  return { chunks: chunks.slice(0, args.maxChunks ?? 10) };
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

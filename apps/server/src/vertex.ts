/**
 * Vertex AI Search client — Sprint 1 fixture stub.
 *
 * Returns hardcoded primary_source entries from moj.go.jp/isa so the tool
 * pipeline (handler → sanitizer → structured response) can be wired end-to-end
 * and verified by MCP Inspector before the real data stores exist.
 *
 * Sprint 2 replaces the body with @google-cloud/discoveryengine calls
 * (confidence ≥ 0.7, source allowlist *.go.jp). The VertexSearchArgs /
 * VertexSearchResult / GroundedChunk shapes are frozen now so the handler
 * stays unchanged.
 *
 * .cursor/gcp.mdc governs real integration: asia-northeast1, BYOSA,
 * roles/discoveryengine.viewer scoped to specific data stores.
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

const FIXTURE_CHUNKS: readonly GroundedChunk[] = [
  {
    title: "特定技能1号 — 在留資格変更許可申請の手引き",
    snippet:
      "特定技能1号への在留資格変更を希望する場合、所属機関との雇用契約、" +
      "技能試験・日本語試験の合格証、支援計画書等の添付が必要です。" +
      "処理期間の目安は標準で1〜3ヶ月です。",
    uri: "https://www.moj.go.jp/isa/applications/procedures/nyuukokukanri07_00201.html",
    confidence: 0.88,
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
    confidence: 0.82,
    publishedAt: "2026-02-20",
    docId: "moj-isa-ssw-overview-2026-02",
  },
];

export async function vertexSearch(args: VertexSearchArgs): Promise<VertexSearchResult> {
  void args;
  const chunks = FIXTURE_CHUNKS.filter((c) => c.confidence >= 0.7);
  return { chunks };
}

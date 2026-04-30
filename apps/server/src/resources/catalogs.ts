import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SOURCE_INDEX_URI = "ssw://catalog/source-index";
const FORMS_CATALOG_URI = "ssw://catalog/forms-catalog";
const INDUSTRY_CANDIDATES_URI = "ssw://catalog/industry-resource-candidates";
const CATALOG_MANIFEST_URI = "ssw://catalog/manifest";

function dataPath(fileName: string): string {
  return resolve(process.cwd(), "data", fileName);
}

async function readJsonl(fileName: string): Promise<unknown[]> {
  const text = await readFile(dataPath(fileName), "utf-8");
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function countBy<T extends string>(rows: unknown[], key: string): Record<T, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const value = (row as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts as Record<T, number>;
}

async function catalogManifest(): Promise<string> {
  const [sources, forms, candidates] = await Promise.all([
    readJsonl("source-index.jsonl"),
    readJsonl("forms-catalog.jsonl"),
    readJsonl("industry-resource-candidates.jsonl"),
  ]);
  return JSON.stringify(
    {
      catalogs: [
        {
          uri: SOURCE_INDEX_URI,
          entries: sources.length,
          description: "Official RAG source index",
        },
        { uri: FORMS_CATALOG_URI, entries: forms.length, description: "Official forms catalog" },
        {
          uri: INDUSTRY_CANDIDATES_URI,
          entries: candidates.length,
          description: "Normalized industry resource candidates",
        },
      ],
      sourceIndexByGroup: countBy(sources, "dataStoreGroup"),
      formsByKind: countBy(forms, "kind"),
      candidatesByCatalog: countBy(candidates, "catalog"),
    },
    null,
    2,
  );
}

function textResource(uri: string, text: string) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text,
      },
    ],
  };
}

export function registerCatalogResources(server: McpServer): void {
  server.registerResource(
    "ssw-catalog-manifest",
    CATALOG_MANIFEST_URI,
    {
      title: "SSW catalog manifest",
      description: "Summary of SSW Compass official source and forms catalogs.",
      mimeType: "application/json",
    },
    async () => textResource(CATALOG_MANIFEST_URI, await catalogManifest()),
  );

  server.registerResource(
    "ssw-source-index",
    SOURCE_INDEX_URI,
    {
      title: "SSW source index",
      description: "JSONL catalog of official primary/delegated source URLs used for RAG.",
      mimeType: "application/x-ndjson",
    },
    async () =>
      textResource(SOURCE_INDEX_URI, await readFile(dataPath("source-index.jsonl"), "utf-8")),
  );

  server.registerResource(
    "ssw-forms-catalog",
    FORMS_CATALOG_URI,
    {
      title: "SSW forms catalog",
      description:
        "JSONL catalog of SSW form bundles, reference forms, omission profiles, and applicant profiles.",
      mimeType: "application/x-ndjson",
    },
    async () =>
      textResource(FORMS_CATALOG_URI, await readFile(dataPath("forms-catalog.jsonl"), "utf-8")),
  );

  server.registerResource(
    "ssw-industry-resource-candidates",
    INDUSTRY_CANDIDATES_URI,
    {
      title: "SSW industry resource candidates",
      description:
        "JSONL staging catalog for normalized official resources across all 16 SSW industries.",
      mimeType: "application/x-ndjson",
    },
    async () =>
      textResource(
        INDUSTRY_CANDIDATES_URI,
        await readFile(dataPath("industry-resource-candidates.jsonl"), "utf-8"),
      ),
  );
}

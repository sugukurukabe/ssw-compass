import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TIMELINE_EVENT_CONTEXT } from "@ssw/shared-types";

const SOURCE_INDEX_URI = "ssw://catalog/source-index";
const FORMS_CATALOG_URI = "ssw://catalog/forms-catalog";
const INDUSTRY_CANDIDATES_URI = "ssw://catalog/industry-resource-candidates";
const CATALOG_MANIFEST_URI = "ssw://catalog/manifest";
const INDUSTRY_FORMS_TEMPLATE_URI = "ssw://catalog/forms/{industry}";
const INDUSTRY_SOURCES_TEMPLATE_URI = "ssw://catalog/sources/{industry}";
const NOTIFICATION_FORMS_TEMPLATE_URI = "ssw://catalog/notifications/{eventContext}";

const FORM_INDUSTRIES = [
  "all",
  "agriculture",
  "fishery",
  "construction",
  "nursing_care",
  "building_cleaning",
  "automobile_repair",
  "aviation",
  "lodging",
  "shipbuilding",
  "food_manufacturing",
  "food_service",
  "industrial_products_manufacturing",
  "automobile_transportation",
  "railway",
  "forestry",
  "wood_products",
] as const;

const SOURCE_INDUSTRIES = [
  "agriculture",
  "fishery",
  "construction",
  "nursing_care",
  "building_cleaning",
  "automobile_repair",
  "automobile_maintenance",
  "aviation",
  "lodging",
  "accommodation",
  "shipbuilding",
  "food_manufacturing",
  "food_service",
  "manufacturing",
  "industrial_products_manufacturing",
  "electronics",
  "automobile_transportation",
  "railway",
  "forestry",
  "wood_products",
] as const;

const NOTIFICATION_EVENT_CONTEXTS = TIMELINE_EVENT_CONTEXT.filter(
  (context) =>
    context === "contract_start" ||
    context === "contract_end" ||
    context === "employment_contract_change" ||
    context === "support_plan_change" ||
    context === "organization_change" ||
    context === "regular_report",
);

type NotificationEventContext = (typeof NOTIFICATION_EVENT_CONTEXTS)[number];

type NotificationForm = {
  id: string;
  title: string;
  sourceUrl: string;
  sourceType: "primary_source";
};

const NOTIFICATION_FORMS_BY_CONTEXT: Record<NotificationEventContext, NotificationForm[]> = {
  contract_start: [
    {
      id: "ref-3-1-1-employment-contract-change",
      title: "特定技能雇用契約の変更に係る届出書 (参考様式第3-1-1号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340519.xlsx",
      sourceType: "primary_source",
    },
  ],
  contract_end: [
    {
      id: "ref-3-1-2-employment-contract-end",
      title: "特定技能雇用契約の終了又は締結に係る届出書 (参考様式第3-1-2号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001378824.xlsx",
      sourceType: "primary_source",
    },
  ],
  employment_contract_change: [
    {
      id: "ref-3-1-1-employment-contract-change",
      title: "特定技能雇用契約の変更に係る届出書 (参考様式第3-1-1号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340519.xlsx",
      sourceType: "primary_source",
    },
  ],
  support_plan_change: [
    {
      id: "ref-3-2-support-plan-change",
      title: "支援計画変更に係る届出書 (参考様式第3-2号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340521.xlsx",
      sourceType: "primary_source",
    },
  ],
  organization_change: [
    {
      id: "ref-4-4-registration-change-appendix",
      title: "登録事項変更に関する届出書別紙 (参考様式第4-4号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001340539.docx",
      sourceType: "primary_source",
    },
  ],
  regular_report: [
    {
      id: "ref-3-6-regular-report",
      title: "受入れ・活動・支援実施状況に係る届出書 (参考様式第3-6号)",
      sourceUrl: "https://www.moj.go.jp/isa/content/001454511.xlsx",
      sourceType: "primary_source",
    },
  ],
};

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

function objectValue(row: unknown, key: string): unknown {
  if (row === null || typeof row !== "object") return undefined;
  return (row as Record<string, unknown>)[key];
}

function stringValue(row: unknown, key: string): string | undefined {
  const value = objectValue(row, key);
  return typeof value === "string" ? value : undefined;
}

function stringArrayValue(row: unknown, key: string): string[] {
  const value = objectValue(row, key);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringVariable(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return value?.[0];
}

function isAllowedValue<const T extends readonly string[]>(
  value: string | undefined,
  allowedValues: T,
): value is T[number] {
  return value !== undefined && allowedValues.includes(value);
}

function jsonResource(uri: string, data: unknown) {
  return textResource(uri, JSON.stringify(data, null, 2), "application/json");
}

function listTemplateResources(
  values: readonly string[],
  uriForValue: (value: string) => string,
  nameForValue: (value: string) => string,
  descriptionForValue: (value: string) => string,
) {
  return {
    resources: values.map((value) => ({
      uri: uriForValue(value),
      name: nameForValue(value),
      description: descriptionForValue(value),
      mimeType: "application/json",
    })),
  };
}

async function formsByIndustry(industry: string): Promise<unknown[]> {
  const forms = await readJsonl("forms-catalog.jsonl");
  return forms.filter((row) => {
    const rowIndustry = stringValue(row, "industry");
    return rowIndustry === undefined || rowIndustry === "all" || rowIndustry === industry;
  });
}

async function sourcesByIndustry(industry: string): Promise<unknown[]> {
  const sources = await readJsonl("source-index.jsonl");
  return sources.filter((row) => {
    const tags = stringArrayValue(row, "tags");
    return tags.includes(industry);
  });
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
        {
          uriTemplate: INDUSTRY_FORMS_TEMPLATE_URI,
          entries: FORM_INDUSTRIES.length,
          description: "Forms catalog filtered by SSW industry key",
        },
        {
          uriTemplate: INDUSTRY_SOURCES_TEMPLATE_URI,
          entries: SOURCE_INDUSTRIES.length,
          description: "Official RAG source catalog filtered by SSW industry key",
        },
        {
          uriTemplate: NOTIFICATION_FORMS_TEMPLATE_URI,
          entries: NOTIFICATION_EVENT_CONTEXTS.length,
          description: "Notification-related reference forms filtered by event context",
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

function textResource(uri: string, text: string, mimeType = "application/json") {
  return {
    contents: [
      {
        uri,
        mimeType,
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
      textResource(
        SOURCE_INDEX_URI,
        await readFile(dataPath("source-index.jsonl"), "utf-8"),
        "application/x-ndjson",
      ),
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
      textResource(
        FORMS_CATALOG_URI,
        await readFile(dataPath("forms-catalog.jsonl"), "utf-8"),
        "application/x-ndjson",
      ),
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
        "application/x-ndjson",
      ),
  );

  server.registerResource(
    "ssw-forms-by-industry",
    new ResourceTemplate(INDUSTRY_FORMS_TEMPLATE_URI, {
      list: async () =>
        listTemplateResources(
          FORM_INDUSTRIES,
          (industry) => `ssw://catalog/forms/${industry}`,
          (industry) => `SSW forms catalog: ${industry}`,
          (industry) => `Forms catalog entries that apply to ${industry}.`,
        ),
      complete: {
        industry: (value) => FORM_INDUSTRIES.filter((industry) => industry.startsWith(value)),
      },
    }),
    {
      title: "SSW forms by industry",
      description: "JSON catalog of SSW form entries filtered by industry key.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const industry = stringVariable(variables["industry"]);
      if (!isAllowedValue(industry, FORM_INDUSTRIES)) {
        return jsonResource(uri.toString(), { error: "unknown_industry", industry });
      }
      return jsonResource(uri.toString(), {
        industry,
        entries: await formsByIndustry(industry),
      });
    },
  );

  server.registerResource(
    "ssw-sources-by-industry",
    new ResourceTemplate(INDUSTRY_SOURCES_TEMPLATE_URI, {
      list: async () =>
        listTemplateResources(
          SOURCE_INDUSTRIES,
          (industry) => `ssw://catalog/sources/${industry}`,
          (industry) => `SSW source index: ${industry}`,
          (industry) => `Official source-index entries tagged for ${industry}.`,
        ),
      complete: {
        industry: (value) => SOURCE_INDUSTRIES.filter((industry) => industry.startsWith(value)),
      },
    }),
    {
      title: "SSW sources by industry",
      description: "JSON catalog of official source-index entries filtered by industry key.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const industry = stringVariable(variables["industry"]);
      if (!isAllowedValue(industry, SOURCE_INDUSTRIES)) {
        return jsonResource(uri.toString(), { error: "unknown_industry", industry });
      }
      return jsonResource(uri.toString(), {
        industry,
        entries: await sourcesByIndustry(industry),
      });
    },
  );

  server.registerResource(
    "ssw-notification-forms-by-context",
    new ResourceTemplate(NOTIFICATION_FORMS_TEMPLATE_URI, {
      list: async () =>
        listTemplateResources(
          NOTIFICATION_EVENT_CONTEXTS,
          (eventContext) => `ssw://catalog/notifications/${eventContext}`,
          (eventContext) => `SSW notification forms: ${eventContext}`,
          (eventContext) => `Reference forms related to the ${eventContext} deadline context.`,
        ),
      complete: {
        eventContext: (value) =>
          NOTIFICATION_EVENT_CONTEXTS.filter((eventContext) => eventContext.startsWith(value)),
      },
    }),
    {
      title: "SSW notification forms by context",
      description: "JSON catalog of notification reference forms filtered by event context.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const eventContext = stringVariable(variables["eventContext"]);
      if (!isAllowedValue(eventContext, NOTIFICATION_EVENT_CONTEXTS)) {
        return jsonResource(uri.toString(), { error: "unknown_event_context", eventContext });
      }
      return jsonResource(uri.toString(), {
        eventContext,
        entries: NOTIFICATION_FORMS_BY_CONTEXT[eventContext],
      });
    },
  );
}

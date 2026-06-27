/**
 * Server Card — public discovery document served at /.well-known/mcp.json.
 *
 * Field layout follows v2 §8.3 (the authoritative shape for SSW submissions).
 * This is the same packet that will ship with the Anthropic Connectors
 * Directory and OpenAI Apps SDK submission in Sprint 4, so the fields are
 * fixed here to avoid drift.
 *
 * Note: the upstream MCP Server Card spec (SEP-1649 / SEP-2127) is still at
 * proposal stage. If the final spec converges on a different shape, adjust
 * under ADR — v2 §8.3 remains the product-level source of truth.
 */

export interface ServerCardPublisher {
  name: string;
  url: string;
}

export interface ServerCardCapabilities {
  tools: boolean;
  resources: boolean;
  apps: boolean;
  tasks: boolean;
  prompts: boolean;
}

export interface ServerCardAuth {
  type: "none" | "oauth2" | "bearer";
}

export interface ServerCardCompliance {
  dataResidency: string;
  certifications: readonly string[];
  regulatoryFramework: readonly string[];
}

export interface ServerCard {
  name: string;
  version: string;
  description: string;
  publisher: ServerCardPublisher;
  capabilities: ServerCardCapabilities;
  auth: ServerCardAuth;
  compliance: ServerCardCompliance;
  categories: readonly string[];
  limitations: readonly string[];
  license?: string;
  privacyPolicy?: string;
  termsOfService?: string;
  protocolVersions?: readonly string[];
  tools?: readonly string[];
}

const TOOL_NAMES = [
  "search_visa",
  "classify_procedure",
  "get_deadline_timeline",
  "list_visa_documents",
  "validate_zairyu_compatibility",
  "list_law_updates",
  "submit_gyoseishoshi_approval",
  "prepare_document_package",
  "get_package_status",
] as const;

const SERVER_CARD: ServerCard = {
  name: "SSW Compass",
  // T10 ③: 製品現行版。serverInfo.version (server.ts) / server/discover / package.json も
  // 同値 (2.1.0) に統一。openapi.json の info.version (4.0.0) は OpenAPI 文書版で役割が別。
  version: "2.1.0",
  description:
    "Official-source-grounded informational app for Japanese specified-skilled-worker (SSW / 特定技能) and related visa procedures. " +
    "Six anonymous read-only tools cover search, procedure classification, deadlines, document checklists, law updates, and zairyu compatibility. " +
    "Three additional Pro-tier tools record a certified gyoseishoshi's approval, prepare document packages, and report package status (authenticated; anonymous callers blocked). " +
    "Information only — not legal advice.",
  publisher: {
    name: "スグクル株式会社",
    url: "https://mcp.ssw-compass.jp", // ADR-012: prod URL (Batch 11)
  },
  capabilities: {
    tools: true,
    resources: true,
    apps: true,
    tasks: true,
    // T10 ②: prompts は実装済み (registerWorkflowPrompts で 3 prompt 登録)。
    // initialize / server/discover が `prompts:{}` を広告する実態に合わせ true に整合。
    // T10 ②: prompts are implemented (3 prompts via registerWorkflowPrompts); align
    // with initialize / server/discover advertising `prompts:{}`.
    // T10 ②: prompts sudah diimplementasikan; selaraskan dengan initialize/server/discover.
    prompts: true,
  },
  // Public connector submission path: anonymous read-only access is available.
  auth: {
    type: "none",
  },
  compliance: {
    dataResidency: "JP",
    certifications: ["P-Mark-roadmap"],
    regulatoryFramework: ["JP-PIPL", "JP-Immigration-Law"],
  },
  categories: ["regulated-industry", "immigration", "japan", "informational"],
  limitations: [
    "Provides general information only.",
    "Grounds answers in official or delegated official sources.",
    "Does not accept personal identifiers as input.",
    "Does not generate or file government documents.",
    "For individual procedures, consult a certified professional or the responsible authority.",
  ],
  license: "Apache-2.0",
  privacyPolicy: "https://mcp.ssw-compass.jp/privacy",
  termsOfService: "https://mcp.ssw-compass.jp/privacy",
  protocolVersions: ["2025-11-25", "2026-07-28"],
  tools: TOOL_NAMES,
};

export function buildServerCard(): ServerCard {
  return SERVER_CARD;
}

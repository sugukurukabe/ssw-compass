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
}

const SERVER_CARD: ServerCard = {
  name: "SSW Compass",
  version: "1.0.0",
  description:
    "Official-source-grounded informational app for Japanese specified-skilled-worker (SSW / 特定技能) and related visa procedures. Information only — does not constitute legal advice.",
  publisher: {
    name: "スグクル株式会社",
    url: "https://sugu-kuru.co.jp",
  },
  capabilities: {
    tools: true,
    resources: true,
    apps: true,
    tasks: false,
    prompts: false,
  },
  auth: { type: "none" },
  compliance: {
    dataResidency: "JP",
    certifications: ["P-Mark-roadmap"],
    regulatoryFramework: ["JP-PIPL", "JP-Immigration-Law"],
  },
  categories: ["regulated-industry", "immigration", "japan", "informational"],
  limitations: [
    "Provides general information only.",
    "Does not perform legal representation under Japanese 行政書士法 §19-1.",
    "Does not accept personal identifiers as input.",
    "Does not generate or file government documents.",
  ],
};

export function buildServerCard(): ServerCard {
  return SERVER_CARD;
}

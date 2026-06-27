import process from "node:process";

const READ_ONLY_TOOLS = [
  "search_visa",
  "classify_procedure",
  "get_deadline_timeline",
  "list_visa_documents",
  "list_law_updates",
  "validate_zairyu_compatibility",
];

const PRO_TOOLS = [
  "submit_gyoseishoshi_approval",
  "prepare_document_package",
  "get_package_status",
];

const REQUIRED_UI_RESOURCES = [
  // v2.1 primary URIs (semver scheme)
  "ui://compass/search/1.0.0.html",
  "ui://compass/classify/1.0.0.html",
  "ui://compass/timeline/1.0.0.html",
  "ui://compass/checklist/1.0.0.html",
  "ui://compass/validate/1.0.0.html",
  // legacy aliases kept for host review caches
  "ui://ssw-search/mcp-app.html",
  "ui://ssw-classify/mcp-app.html",
  "ui://ssw-timeline/mcp-app.html",
  "ui://ssw-checklist/mcp-app.html",
  "ui://ssw-validate/mcp-app.html",
];

const REQUIRED_CATALOG_RESOURCES = [
  "ssw://catalog/manifest",
  "ssw://catalog/source-index",
  "ssw://catalog/forms-catalog",
  "ssw://catalog/industry-resource-candidates",
];

const REQUIRED_RESOURCE_TEMPLATES = [
  "ssw://catalog/forms/{industry}",
  "ssw://catalog/sources/{industry}",
  "ssw://catalog/notifications/{eventContext}",
];

const REQUIRED_DYNAMIC_RESOURCES = [
  "ssw://catalog/forms/agriculture",
  "ssw://catalog/sources/agriculture",
  "ssw://catalog/notifications/regular_report",
];

const REQUIRED_PROMPTS = [
  "ssw_new_staff_intake_check",
  "ssw_route_and_documents",
  "ssw_notification_deadlines",
];

const mcpUrl = process.env["MCP_URL"];
if (mcpUrl === undefined || mcpUrl.length === 0) {
  console.error(
    "MCP_URL is required. Example: MCP_URL=https://mcp.ssw-compass.jp/mcp pnpm smoke:mcp",
  );
  process.exit(2);
}
const mcpAuthToken = process.env["MCP_AUTH_TOKEN"];
const requiredTools =
  mcpAuthToken === undefined || mcpAuthToken.length === 0
    ? READ_ONLY_TOOLS
    : [...READ_ONLY_TOOLS, ...PRO_TOOLS];

function parseSse(text) {
  const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith("data: "));
  if (line === undefined) {
    throw new Error(`No SSE data line found. Response starts with: ${text.slice(0, 160)}`);
  }
  return JSON.parse(line.slice("data: ".length));
}

async function rpc(method, params, id, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (mcpAuthToken !== undefined && mcpAuthToken.length > 0) {
    headers.Authorization = `Bearer ${mcpAuthToken}`;
  }
  if (sessionId !== undefined) {
    headers["Mcp-Session-Id"] = sessionId;
  }
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} failed: HTTP ${response.status} ${text.slice(0, 200)}`);
  }
  return { response, payload: parseSse(text) };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

function parseJsonResource(payload, uri) {
  const text = payload.result?.contents?.[0]?.text ?? "";
  expect(typeof text === "string" && text.length > 0, `${uri} returns text content`);
  return JSON.parse(text);
}

const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {
      extensions: {
        "io.modelcontextprotocol/ui": {
          mimeTypes: ["text/html;profile=mcp-app"],
        },
      },
    },
    clientInfo: { name: "ssw-smoke", version: "1.0.0" },
  },
  1,
);

// Stateless Streamable HTTP: the server does NOT issue an mcp-session-id, and
// every request is self-contained. sessionId is therefore expected to be
// undefined; follow-up requests omit the header.
const sessionId = init.response.headers.get("mcp-session-id") ?? undefined;
expect(sessionId === undefined, "initialize is stateless (no mcp-session-id)");
expect(init.payload.result?.capabilities?.tools !== undefined, "initialize advertises tools");
expect(
  init.payload.result?.capabilities?.resources !== undefined,
  "initialize advertises resources",
);

await fetch(mcpUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});

const tools = await rpc("tools/list", {}, 2, sessionId);
const toolList = tools.payload.result?.tools ?? [];
const toolNames = toolList.map((tool) => tool.name);
for (const toolName of requiredTools) {
  expect(toolNames.includes(toolName), `tools/list includes ${toolName}`);
}
if (mcpAuthToken === undefined || mcpAuthToken.length === 0) {
  for (const toolName of PRO_TOOLS) {
    expect(!toolNames.includes(toolName), `anonymous tools/list hides ${toolName}`);
  }
}

for (const tool of toolList.filter((candidate) => requiredTools.includes(candidate.name))) {
  expect(tool.annotations !== undefined, `${tool.name} has annotations`);
  expect(tool.inputSchema !== undefined, `${tool.name} has inputSchema`);
}

const resources = await rpc("resources/list", {}, 3, sessionId);
const resourceList = resources.payload.result?.resources ?? [];
const resourceUris = resourceList.map((resource) => resource.uri);
for (const resourceUri of REQUIRED_UI_RESOURCES) {
  expect(resourceUris.includes(resourceUri), `resources/list includes ${resourceUri}`);
}
for (const resourceUri of REQUIRED_CATALOG_RESOURCES) {
  expect(resourceUris.includes(resourceUri), `resources/list includes ${resourceUri}`);
}
for (const resourceUri of REQUIRED_DYNAMIC_RESOURCES) {
  expect(resourceUris.includes(resourceUri), `resources/list includes ${resourceUri}`);
}

const resourceTemplates = await rpc("resources/templates/list", {}, 4, sessionId);
const resourceTemplateList = resourceTemplates.payload.result?.resourceTemplates ?? [];
const resourceTemplateUris = resourceTemplateList.map((template) => template.uriTemplate);
for (const templateUri of REQUIRED_RESOURCE_TEMPLATES) {
  expect(
    resourceTemplateUris.includes(templateUri),
    `resources/templates/list includes ${templateUri}`,
  );
}

for (let i = 0; i < REQUIRED_UI_RESOURCES.length; i += 1) {
  const uri = REQUIRED_UI_RESOURCES[i];
  const read = await rpc("resources/read", { uri }, 10 + i, sessionId);
  const content = read.payload.result?.contents?.[0];
  expect(content?.mimeType === "text/html;profile=mcp-app", `${uri} has MCP App MIME type`);
  expect(
    typeof content?.text === "string" && content.text.includes("Content-Security-Policy"),
    `${uri} includes CSP`,
  );
  expect(
    typeof content?.text === "string" && content.text.includes("trusted-types"),
    `${uri} includes Trusted Types CSP`,
  );
}

const manifest = await rpc("resources/read", { uri: "ssw://catalog/manifest" }, 20, sessionId);
const manifestText = manifest.payload.result?.contents?.[0]?.text ?? "";
expect(
  typeof manifestText === "string" && manifestText.includes("sourceIndexByGroup"),
  "catalog manifest includes sourceIndexByGroup",
);

const dynamicForms = await rpc(
  "resources/read",
  { uri: "ssw://catalog/forms/agriculture" },
  21,
  sessionId,
);
const dynamicFormsJson = parseJsonResource(dynamicForms.payload, "ssw://catalog/forms/agriculture");
expect(dynamicFormsJson.industry === "agriculture", "industry forms resource echoes agriculture");
expect(
  Array.isArray(dynamicFormsJson.entries) && dynamicFormsJson.entries.length > 0,
  "industry forms resource includes entries",
);

const dynamicSources = await rpc(
  "resources/read",
  { uri: "ssw://catalog/sources/agriculture" },
  22,
  sessionId,
);
const dynamicSourcesJson = parseJsonResource(
  dynamicSources.payload,
  "ssw://catalog/sources/agriculture",
);
expect(
  dynamicSourcesJson.industry === "agriculture",
  "industry sources resource echoes agriculture",
);
expect(
  Array.isArray(dynamicSourcesJson.entries) && dynamicSourcesJson.entries.length > 0,
  "industry sources resource includes entries",
);

const dynamicNotifications = await rpc(
  "resources/read",
  { uri: "ssw://catalog/notifications/regular_report" },
  23,
  sessionId,
);
const dynamicNotificationsJson = parseJsonResource(
  dynamicNotifications.payload,
  "ssw://catalog/notifications/regular_report",
);
expect(
  dynamicNotificationsJson.eventContext === "regular_report",
  "notification forms resource echoes regular_report",
);
expect(
  Array.isArray(dynamicNotificationsJson.entries) && dynamicNotificationsJson.entries.length > 0,
  "notification forms resource includes entries",
);

const prompts = await rpc("prompts/list", {}, 30, sessionId);
const promptList = prompts.payload.result?.prompts ?? [];
const promptNames = promptList.map((prompt) => prompt.name);
for (const promptName of REQUIRED_PROMPTS) {
  expect(promptNames.includes(promptName), `prompts/list includes ${promptName}`);
}

const routePrompt = await rpc(
  "prompts/get",
  {
    name: "ssw_route_and_documents",
    arguments: {
      current_status: "技能実習2号",
      target_status: "特定技能1号",
      industry: "農業",
      receiving_organization_profile: "法人",
    },
  },
  40,
  sessionId,
);
const routePromptText = routePrompt.payload.result?.messages?.[0]?.content?.text ?? "";
expect(
  typeof routePromptText === "string" && routePromptText.includes("classify_procedure"),
  "ssw_route_and_documents prompt mentions classify_procedure",
);

console.log("\nMCP smoke completed.");

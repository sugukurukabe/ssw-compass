import process from "node:process";

const REQUIRED_TOOLS = [
  "search_visa",
  "classify_procedure",
  "get_deadline_timeline",
  "list_visa_documents",
  "list_law_updates",
  "submit_gyoseishoshi_approval",
  "validate_zairyu_compatibility",
];

const REQUIRED_UI_RESOURCES = [
  "ui://ssw-search/mcp-app.html",
  "ui://ssw-classify/mcp-app.html",
  "ui://ssw-timeline/mcp-app.html",
  "ui://ssw-checklist/mcp-app.html",
  "ui://ssw-validate/mcp-app.html",
];

const mcpUrl = process.env["MCP_URL"];
if (mcpUrl === undefined || mcpUrl.length === 0) {
  console.error(
    "MCP_URL is required. Example: MCP_URL=https://mcp.ssw-compass.jp/mcp pnpm smoke:mcp",
  );
  process.exit(2);
}

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

const sessionId = init.response.headers.get("mcp-session-id") ?? undefined;
expect(sessionId !== undefined, "initialize returns mcp-session-id");
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
    "Mcp-Session-Id": sessionId,
  },
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});

const tools = await rpc("tools/list", {}, 2, sessionId);
const toolList = tools.payload.result?.tools ?? [];
const toolNames = toolList.map((tool) => tool.name);
for (const toolName of REQUIRED_TOOLS) {
  expect(toolNames.includes(toolName), `tools/list includes ${toolName}`);
}

for (const tool of toolList.filter((candidate) => REQUIRED_TOOLS.includes(candidate.name))) {
  expect(tool.annotations !== undefined, `${tool.name} has annotations`);
  expect(tool.inputSchema !== undefined, `${tool.name} has inputSchema`);
}

const resources = await rpc("resources/list", {}, 3, sessionId);
const resourceList = resources.payload.result?.resources ?? [];
const resourceUris = resourceList.map((resource) => resource.uri);
for (const resourceUri of REQUIRED_UI_RESOURCES) {
  expect(resourceUris.includes(resourceUri), `resources/list includes ${resourceUri}`);
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

console.log("\nMCP smoke completed.");

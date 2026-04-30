import process from "node:process";

const DEFAULT_INDUSTRIES = ["agriculture", "construction", "railway", "wood_products"];
const ALL_INDUSTRIES = [
  "nursing_care",
  "building_cleaning",
  "industrial_products_manufacturing",
  "construction",
  "shipbuilding",
  "automobile_maintenance",
  "aviation",
  "accommodation",
  "agriculture",
  "fishery",
  "food_manufacturing",
  "food_service",
  "automobile_transportation",
  "railway",
  "forestry",
  "wood_products",
];

const TITLE_TERMS = {
  nursing_care: ["介護"],
  building_cleaning: ["ビルクリーニング"],
  industrial_products_manufacturing: ["工業製品製造業", "製造業"],
  construction: ["建設"],
  shipbuilding: ["造船", "舶用工業"],
  automobile_maintenance: ["自動車整備"],
  aviation: ["航空"],
  accommodation: ["宿泊"],
  agriculture: ["農業"],
  fishery: ["漁業"],
  food_manufacturing: ["飲食料品製造業"],
  food_service: ["外食業"],
  automobile_transportation: ["自動車運送業"],
  railway: ["鉄道"],
  forestry: ["林業"],
  wood_products: ["木材産業"],
};

const mcpUrl = process.env["MCP_URL"] ?? "https://mcp.ssw-compass.jp/mcp";
const strict = process.argv.includes("--strict");
const all = process.argv.includes("--all");
const delayMsArg = process.argv
  .find((arg) => arg.startsWith("--delay-ms="))
  ?.slice("--delay-ms=".length);
const delayMs = delayMsArg === undefined ? 1000 : Number.parseInt(delayMsArg, 10);
const industriesArg = process.argv
  .find((arg) => arg.startsWith("--industries="))
  ?.slice("--industries=".length);
const industries =
  industriesArg !== undefined && industriesArg.length > 0
    ? industriesArg.split(",").map((industry) => industry.trim())
    : all
      ? ALL_INDUSTRIES
      : DEFAULT_INDUSTRIES;

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
    throw new Error(`${method} failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  return { response, payload: parseSse(text) };
}

function expectedTitleMatch(industry, title) {
  const terms = TITLE_TERMS[industry] ?? [];
  return terms.some((term) => title.includes(term));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const failures = [];
const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "ssw-search-smoke", version: "1.0.0" },
  },
  1,
);
const sessionId = init.response.headers.get("mcp-session-id") ?? undefined;
if (sessionId === undefined) {
  throw new Error("initialize did not return mcp-session-id");
}

await fetch(mcpUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "Mcp-Session-Id": sessionId,
  },
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});

console.log(`MCP_URL=${mcpUrl}`);
console.log(`industries=${industries.join(",")}`);

for (const [index, industry] of industries.entries()) {
  if (index > 0 && delayMs > 0) {
    await sleep(delayMs);
  }
  const call = await rpc(
    "tools/call",
    {
      name: "search_visa",
      arguments: {
        category: "tokutei_ginou_1",
        industry,
        yearMonth: "2026-09",
        language: "ja",
        response_style: "concise",
        enable_followup_suggestions: true,
      },
    },
    10 + index,
    sessionId,
  );
  if (call.payload.error !== undefined) {
    failures.push(`${industry}: ${JSON.stringify(call.payload.error)}`);
    continue;
  }

  const toolText = call.payload.result?.content?.map((item) => item.text).join("\n") ?? "";
  if (toolText.includes("RESOURCE_EXHAUSTED") || toolText.includes("Quota exceeded")) {
    failures.push(`${industry}: Vertex Search quota exhausted`);
    console.log(`\n## ${industry} FAIL`);
    console.log(toolText.split("\n")[0] ?? "");
    continue;
  }

  const results = call.payload.result?.structuredContent?.results ?? [];
  const firstTitle = results[0]?.title ?? "";
  const ok = results.length > 0 && expectedTitleMatch(industry, firstTitle);
  console.log(`\n## ${industry} ${ok ? "OK" : "WARN"}`);
  console.log(`count=${results.length} first=${firstTitle}`);
  for (const [resultIndex, result] of results.slice(0, 3).entries()) {
    console.log(`${resultIndex + 1}. ${result.title}`);
    console.log(`   ${result.sourceUrl}`);
  }

  if (strict && !ok) {
    failures.push(`${industry}: first result does not match expected title terms (${firstTitle})`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exit(1);
}

console.log("\nsearch smoke completed.");

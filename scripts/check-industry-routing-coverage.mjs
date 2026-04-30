import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readJsonl } from "./rag-shared.mjs";

const CANDIDATES_PATH = resolve(process.cwd(), "data/industry-resource-candidates.jsonl");
const ROUTING_PATH = resolve(process.cwd(), "apps/server/src/industry-routing.ts");
const candidates = await readJsonl(CANDIDATES_PATH);
const routingText = await readFile(ROUTING_PATH, "utf-8");
const failures = [];
const constants = Object.fromEntries(
  [...routingText.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*"([^"]+)";/g)].map((match) => [
    match[1],
    match[2],
  ]),
);

function sourceAllowlistForIndustry(industry) {
  const escaped = industry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = routingText.match(new RegExp(`${escaped}:\\s+route\\(\\s*\\[([^\\]]+)\\]`, "m"));
  if (match?.[1] === undefined) return ["*.go.jp"];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => {
      const stringMatch = entry.match(/^"([^"]+)"$/);
      if (stringMatch?.[1] !== undefined) return stringMatch[1];
      return constants[entry];
    })
    .filter((entry) => typeof entry === "string" && entry.length > 0);
}

function matchHostPattern(host, pattern) {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) || host === suffix.slice(1);
  }
  return host === pattern;
}

for (const candidate of candidates) {
  if (candidate.catalog !== "source_index") continue;
  if (candidate.industry_key === "_global") continue;
  const host = new URL(candidate.url).hostname;
  const allowlist = sourceAllowlistForIndustry(candidate.industry_key);
  if (!allowlist.some((pattern) => matchHostPattern(host, pattern))) {
    failures.push(`${candidate.industry_key}: ${host} not in ${allowlist.join(", ")}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("industry routing coverage passed.");

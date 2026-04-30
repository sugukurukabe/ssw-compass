import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BRANCH, COLLECTION, ENDPOINT, LOCATION, PROJECT_ID, parseArgs } from "./rag-shared.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.metadataFile === null) {
  console.log(
    "Usage: pnpm import:rag -- --metadata-file=data/agent-search-visa_forms_v2.2026-04-30.ndjson --filter=visa_forms_v2",
  );
  process.exit(args.help ? 0 : 2);
}

if (args.filter === null) {
  throw new Error("--filter=<dataStoreId> is required for import:rag");
}

const text = await readFile(resolve(process.cwd(), args.metadataFile), "utf-8");
const documents = text
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

console.log(
  `import-agent-search: project=${PROJECT_ID} location=${LOCATION} endpoint=${ENDPOINT} dataStore=${args.filter} docs=${documents.length}`,
);

const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/${COLLECTION}/dataStores/${args.filter}/branches/${BRANCH}`;

if (args.dryRun) {
  console.log("dry-run: importDocuments not called");
  process.exit(0);
}

const accessToken = process.env["GOOGLE_OAUTH_ACCESS_TOKEN"];
if (accessToken === undefined || accessToken.length === 0) {
  throw new Error(
    "GOOGLE_OAUTH_ACCESS_TOKEN is required for import:rag. Run: export GOOGLE_OAUTH_ACCESS_TOKEN=\"$(gcloud auth print-access-token)\"",
  );
}

async function authedFetch(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Goog-User-Project": PROJECT_ID,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${text}`);
  }
  return JSON.parse(text);
}

const operation = await authedFetch(`https://${ENDPOINT}/v1/${parent}/documents:import`, {
  method: "POST",
  body: JSON.stringify({
    inlineSource: { documents },
    reconciliationMode: "INCREMENTAL",
  }),
});

console.log(`LRO started: ${operation.name ?? "(unnamed)"}`);

let current = operation;
for (let i = 0; i < 120; i += 1) {
  if (current.done === true) break;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  current = await authedFetch(`https://${ENDPOINT}/v1/${current.name}`, { method: "GET" });
  console.log(`poll ${i + 1}: done=${current.done === true}`);
}

if (current.done !== true) {
  throw new Error(`Import operation did not finish within polling window: ${operation.name}`);
}
if (current.error !== undefined) {
  throw new Error(`Import operation failed: ${JSON.stringify(current.error)}`);
}
console.log("operation:", JSON.stringify(current, null, 2));

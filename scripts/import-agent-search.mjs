import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DocumentServiceClient } from "@google-cloud/discoveryengine";
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

if (args.dryRun) {
  console.log("dry-run: importDocuments not called");
  process.exit(0);
}

const client = new DocumentServiceClient({ apiEndpoint: ENDPOINT });
const parent = client.projectLocationCollectionDataStoreBranchPath(
  PROJECT_ID,
  LOCATION,
  COLLECTION,
  args.filter,
  BRANCH,
);

const [operation] = await client.importDocuments({
  parent,
  inlineSource: { documents },
  reconciliationMode: "INCREMENTAL",
});

console.log(`LRO started: ${operation.name ?? "(unnamed)"}`);
const [_response, metadata] = await operation.promise();
console.log("metadata:", JSON.stringify(metadata ?? {}, null, 2));

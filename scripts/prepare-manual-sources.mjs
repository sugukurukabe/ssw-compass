import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import iconv from "iconv-lite";
import { bucketNames, uploadObject } from "./rag-shared.mjs";

const args = {
  zip: "data/manual=sources/manual-sources-2026-04-30.zip",
  env: "prod",
  runDate: new Date().toISOString().slice(0, 10),
  dryRun: false,
};

for (const raw of process.argv.slice(2)) {
  if (raw === "--") continue;
  if (raw === "--dry-run") args.dryRun = true;
  else if (raw.startsWith("--zip=")) args.zip = raw.slice("--zip=".length);
  else if (raw.startsWith("--env=")) args.env = raw.slice("--env=".length);
  else if (raw.startsWith("--run-date=")) args.runDate = raw.slice("--run-date=".length);
  else if (raw === "--help" || raw === "-h") {
    console.log(
      "Usage: pnpm prepare:manual-sources -- --zip=data/manual=sources/manual-sources-2026-04-30.zip --env=prod",
    );
    process.exit(0);
  } else {
    throw new Error(`Unknown argument: ${raw}`);
  }
}

const INDUSTRY_BY_NUMBER = {
  "01": ["nursing_care", "介護", "mhlw"],
  "02": ["building_cleaning", "ビルクリーニング", "mhlw"],
  "03": ["industrial_products_manufacturing", "工業製品製造業", "meti"],
  "04": ["construction", "建設", "mlit"],
  "05": ["shipbuilding", "造船・舶用工業", "mlit"],
  "06": ["automobile_maintenance", "自動車整備", "mlit"],
  "07": ["aviation", "航空", "mlit"],
  "08": ["accommodation", "宿泊", "mlit"],
  "09": ["automobile_transportation", "自動車運送業", "mlit"],
  10: ["railway", "鉄道", "mlit"],
  11: ["agriculture", "農業", "maff"],
  12: ["fishery", "漁業", "maff"],
  13: ["food_manufacturing", "飲食料品製造業", "maff"],
  14: ["food_service", "外食業", "maff"],
  15: ["forestry", "林業", "maff"],
  16: ["wood_products", "木材産業", "maff"],
};

const zipPath = resolve(process.cwd(), args.zip);
const zipBuffer = await readFile(zipPath);
const { default: yauzl } = await import("yauzl");

function openZip(buffer) {
  return new Promise((resolveOpen, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipfile) => {
      if (error !== null) reject(error);
      else resolveOpen(zipfile);
    });
  });
}

function readEntry(zipfile, entry) {
  return new Promise((resolveRead, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error !== null) {
        reject(error);
        return;
      }
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolveRead(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  });
}

function decodeName(name) {
  return iconv.encode(name, "cp437").toString("utf8").normalize("NFC");
}

const zipfile = await openZip(zipBuffer);
const entries = [];

await new Promise((resolveEntries, reject) => {
  zipfile.readEntry();
  zipfile.on("entry", (entry) => {
    if (entry.fileName.startsWith("__MACOSX/") || !entry.fileName.endsWith(".pdf")) {
      zipfile.readEntry();
      return;
    }
    const decoded = decodeName(entry.fileName);
    const match = decoded.match(/^(\d{2})_(.+?)_(運用要領|運用方針)(?: \((\d+)\))?\.pdf$/);
    if (match !== null) {
      entries.push({
        entry,
        decoded,
        number: match[1],
        kind: match[3],
        variant: match[4] ?? "",
      });
    }
    zipfile.readEntry();
  });
  zipfile.on("end", resolveEntries);
  zipfile.on("error", reject);
});

const selected = [];
for (const [number, [industry, industryJa, ministry]] of Object.entries(INDUSTRY_BY_NUMBER)) {
  for (const kind of ["運用要領", "運用方針"]) {
    const candidates = entries
      .filter((entry) => entry.number === number && entry.kind === kind)
      .sort((a, b) => {
        const av = a.variant === "" ? 0 : Number(a.variant);
        const bv = b.variant === "" ? 0 : Number(b.variant);
        return av - bv;
      });
    const chosen = candidates[0];
    if (chosen === undefined) {
      throw new Error(`Missing ${number} ${industryJa} ${kind}`);
    }
    selected.push({ ...chosen, industry, industryJa, ministry });
  }
}

const accessToken = process.env["GOOGLE_OAUTH_ACCESS_TOKEN"];
if (!args.dryRun && (accessToken === undefined || accessToken.length === 0)) {
  throw new Error("GOOGLE_OAUTH_ACCESS_TOKEN is required unless --dry-run is set");
}

const buckets = bucketNames(args.env);
const rows = [];

for (const item of selected) {
  const body = await readEntry(zipfile, item.entry);
  const sha = createHash("sha256").update(body).digest("hex");
  const docKind = item.kind === "運用要領" ? "operation-guide" : "operation-policy";
  const id = `manual-${item.industry}-${docKind}`;
  const objectName = `official/${item.ministry}/${id}/${sha}.pdf`;
  const gcsUri = `gs://${buckets.raw}/${objectName}`;
  const canonicalUrl = "https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00201.html";
  const row = {
    id,
    structData: {
      title: `${item.industryJa} ${item.kind}`,
      url: canonicalUrl,
      canonicalUrl,
      ministry: item.ministry,
      datastore: "visa_legal",
      dataStoreGroup: "visa_legal_core",
      trustLevel: "primary_source",
      sourceType: "official_page",
      lang: "ja",
      publishedAt: args.runDate,
      contentSha256: sha,
      tags: [
        "ssw_1",
        item.industry,
        item.kind === "運用要領" ? "operation_guide" : "operation_policy",
      ],
      originalFileName: item.decoded,
    },
    content: {
      mimeType: "application/pdf",
      uri: gcsUri,
    },
  };
  rows.push(row);
  if (!args.dryRun) {
    await uploadObject(buckets.raw, objectName, body, "application/pdf", accessToken);
  }
  console.log(`${args.dryRun ? "DRY" : "UPLOADED"} ${id} ${body.length}B -> ${gcsUri}`);
}

const metadataBody = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
const localPath = resolve(
  process.cwd(),
  "data",
  `agent-search-manual-sources-${args.env}.${args.runDate}.ndjson`,
);
await writeFile(localPath, metadataBody, "utf-8");

if (!args.dryRun) {
  await uploadObject(
    buckets.metadata,
    `metadata/${args.runDate}/manual-sources-visa_legal_core_v2.ndjson`,
    Buffer.from(metadataBody),
    "application/x-ndjson",
    accessToken,
  );
}

console.log(`manual sources metadata: ${rows.length} rows -> ${localPath}`);

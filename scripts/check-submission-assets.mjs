import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import process from "node:process";

const strict = process.argv.includes("--strict");
const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf-8"));
}

function imageSizePng(path) {
  const file = readFileSync(path);
  const pngSignature = "89504e470d0a1a0a";
  if (file.subarray(0, 8).toString("hex") !== pngSignature) {
    return null;
  }
  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}

function result(ok, message) {
  return { ok, message };
}

const checks = [];

const manifest = readJson("docs/screenshots/manifest.json");
const screenshots = manifest.screenshots;

checks.push(
  result(
    Array.isArray(screenshots) && screenshots.length >= 3 && screenshots.length <= 5,
    `screenshot count: ${Array.isArray(screenshots) ? screenshots.length : "invalid"}`,
  ),
);

for (const shot of screenshots) {
  const file = resolve(root, shot.file);
  if (!existsSync(file)) {
    checks.push(result(!strict, `${shot.id}: pending (${shot.file} missing)`));
    continue;
  }
  checks.push(result(extname(file).toLowerCase() === ".png", `${shot.id}: PNG extension`));
  const size = imageSizePng(file);
  checks.push(result(size !== null, `${shot.id}: valid PNG signature`));
  if (size !== null) {
    checks.push(
      result(size.width >= manifest.requirements.minWidthPx, `${shot.id}: width ${size.width}px`),
    );
  }
}

const logo = resolve(root, "assets/logo/ssw-compass-icon-512.png");
checks.push(result(existsSync(logo), "logo icon 512 exists"));
if (existsSync(logo)) {
  const size = imageSizePng(logo);
  checks.push(
    result(size !== null && size.width >= 512 && size.height >= 512, "logo icon >=512px"),
  );
}

for (const path of [
  "docs/connectors-directory-submission.md",
  "docs/submission-readiness-audit.md",
  "docs/privacy/privacy-ja.md",
  "docs/privacy/privacy-en.md",
  "docs/privacy/privacy-id.md",
]) {
  checks.push(result(existsSync(resolve(root, path)), `${path} exists`));
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${check.message}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} submission asset check(s) failed.`);
  process.exit(1);
}

console.log("\nSubmission asset check completed.");

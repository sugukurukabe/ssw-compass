#!/usr/bin/env node

/**
 * SSW Compass — post-build CSP hash migration (Sprint 3 Batch 5 Commit 3).
 *
 * Rewrites a built `dist/mcp-app.html` single-file bundle to:
 *   1. Change the Content-Security-Policy meta tag into a Report-Only
 *      header (`Content-Security-Policy-Report-Only`) per v3 §23 rollout.
 *   2. Replace 'unsafe-inline' in script-src/style-src with 'sha256-<hash>'
 *      values computed over the actual inlined <script>/<style> content
 *      plus 'strict-dynamic' for script-src.
 *   3. Append Trusted Types directives
 *      (`require-trusted-types-for 'script'; trusted-types ssw-purify dompurify`).
 *
 * Source mcp-app.html keeps the enforcing CSP + unsafe-inline so Vite's
 * dev server (pnpm dev) continues to work without per-run hashing. The
 * production `dist/` artefacts alone get the hardened Report-Only CSP.
 *
 * CLI:
 *   node scripts/compute-csp-hashes.mjs <path/to/dist/mcp-app.html>
 *
 * Wired into each `ui/ssw-<name>/package.json` as a `postbuild` script
 * so running `pnpm -F @ssw/ui-ssw-<name> build` leaves the hardened
 * HTML in place without additional operator intervention.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const INLINE_STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;
const META_CSP_REGEX = /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/i;

function sha256b64(input) {
  return createHash("sha256").update(input, "utf8").digest("base64");
}

function extractBlocks(html, regex) {
  const hashes = [];
  // The regex is global; reset lastIndex before iterating for safety.
  regex.lastIndex = 0;
  for (const match of html.matchAll(regex)) {
    hashes.push(`'sha256-${sha256b64(match[1])}'`);
  }
  return hashes;
}

function buildCsp(scriptHashes, styleHashes) {
  const scriptSrc = ["'self'", ...scriptHashes, "'strict-dynamic'"].join(" ");
  const styleSrc = ["'self'", ...styleHashes].join(" ");
  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "require-trusted-types-for 'script'",
    // Allow both our reserved ssw-purify policy (Sprint 4 migration target)
    // and the default "dompurify" policy DOMPurify creates automatically.
    "trusted-types ssw-purify dompurify",
  ].join("; ");
}

async function hardenHtml(path) {
  const original = await readFile(path, "utf8");
  if (!META_CSP_REGEX.test(original)) {
    throw new Error(
      `${path}: could not find <meta http-equiv="Content-Security-Policy"> tag to rewrite.`,
    );
  }
  const scriptHashes = extractBlocks(original, INLINE_SCRIPT);
  const styleHashes = extractBlocks(original, INLINE_STYLE);
  if (scriptHashes.length === 0 && styleHashes.length === 0) {
    throw new Error(
      `${path}: no inline <script> or <style> blocks found. Expected at least one of each.`,
    );
  }
  const csp = buildCsp(scriptHashes, styleHashes);
  const replacement = `<meta http-equiv="Content-Security-Policy-Report-Only" content="${csp}" />`;
  const rewritten = original.replace(META_CSP_REGEX, replacement);
  await writeFile(path, rewritten, "utf8");
  console.log(
    `  ${path}: ${scriptHashes.length} script hash(es), ${styleHashes.length} style hash(es), Report-Only applied`,
  );
}

async function main() {
  const paths = argv.slice(2);
  if (paths.length === 0) {
    console.error("Usage: node scripts/compute-csp-hashes.mjs <dist-html-path> [...]");
    process.exit(1);
  }
  for (const p of paths) {
    await hardenHtml(p);
  }
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * UI asset loader — reads single-file HTML bundles produced by
 * `ui/<name>/dist/mcp-app.html` and memoizes them in-process.
 *
 * Resolution order (first hit wins):
 * 1. UI_DIST_ROOT env var (explicit override, used in Docker image where the
 *    build output is copied to /app/ui)
 * 2. Monorepo relative path from this module's on-disk location
 *    (dev / pnpm workspace layout)
 *
 * Cold start performs one disk read per UI; subsequent calls are served from
 * memory. No dynamic reload — when the UI changes, redeploy.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, string>();

function resolveDistPath(uiName: string): string {
  const override = process.env["UI_DIST_ROOT"];
  if (override !== undefined && override.length > 0) {
    return resolve(override, uiName, "dist", "mcp-app.html");
  }
  return resolve(__dirname, "..", "..", "..", "ui", uiName, "dist", "mcp-app.html");
}

export async function loadUiHtml(
  uiName: "vcj-search" | "vcj-classify" | "vcj-timeline" | "vcj-checklist",
): Promise<string> {
  const cached = cache.get(uiName);
  if (cached !== undefined) {
    return cached;
  }
  const path = resolveDistPath(uiName);
  const text = await readFile(path, "utf-8");
  cache.set(uiName, text);
  return text;
}

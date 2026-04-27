import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, "mcp-app.html"),
      output: { inlineDynamicImports: true },
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    assetsInlineLimit: 100 * 1024,
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

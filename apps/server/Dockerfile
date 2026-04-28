# syntax=docker/dockerfile:1.9
# SSW MCP server — multi-stage build on Node 22 LTS with distroless runtime.
# Build context: monorepo root (ssw-public/).

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.0

############################################
# Stage 1: builder                         #
############################################
FROM node:${NODE_VERSION}-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json biome.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/ui-bridge/package.json ./packages/ui-bridge/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY ui/ssw-search/package.json ./ui/ssw-search/package.json
COPY ui/ssw-classify/package.json ./ui/ssw-classify/package.json
COPY ui/ssw-timeline/package.json ./ui/ssw-timeline/package.json
COPY ui/ssw-checklist/package.json ./ui/ssw-checklist/package.json

# Install everything needed for server + 4 UI builds.
# `...` includes transitive workspace deps (shared-types, ui-bridge).
RUN pnpm install --frozen-lockfile \
  --filter=@ssw/server... \
  --filter=@ssw/ui-ssw-search... \
  --filter=@ssw/ui-ssw-classify... \
  --filter=@ssw/ui-ssw-timeline... \
  --filter=@ssw/ui-ssw-checklist...

COPY packages/shared-types ./packages/shared-types
COPY packages/ui-bridge ./packages/ui-bridge
COPY apps/server ./apps/server
COPY ui ./ui
# CSP postbuild hook runs scripts/compute-csp-hashes.mjs per UI.
COPY scripts ./scripts

# Build server + 4 UIs (fan-out + fan-in via turbo's graph). UIs
# depend on @ssw/shared-types and @ssw/ui-bridge, which turbo picks
# up via `build.dependsOn: ["^build"]`. Each UI's postbuild hook
# rewrites dist/mcp-app.html CSP to the hash-based Report-Only form
# per ADR-012 §Decision 4 adjacent work.
RUN pnpm exec turbo run build \
  --filter=@ssw/server \
  --filter=@ssw/ui-ssw-search \
  --filter=@ssw/ui-ssw-classify \
  --filter=@ssw/ui-ssw-timeline \
  --filter=@ssw/ui-ssw-checklist

# pnpm 10 default requires inject-workspace-packages=true. We use
# workspace:* without injection, so pass --legacy (equivalent to pnpm
# < 10 behaviour) to have pnpm resolve workspace deps into /app's
# node_modules by symlink-equivalent copy.
RUN pnpm deploy --legacy --filter=@ssw/server --prod /app

############################################
# Stage 2: runtime (distroless)            #
############################################
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV UI_DIST_ROOT=/app/ui
WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
# Ship the hardened single-file UI bundles so the server can serve
# ui://ssw-<name>/mcp-app.html resources at runtime. UI_DIST_ROOT is
# read by [apps/server/src/ui-assets.ts](apps/server/src/ui-assets.ts).
COPY --from=builder --chown=nonroot:nonroot /workspace/ui/ssw-search/dist ./ui/ssw-search/dist
COPY --from=builder --chown=nonroot:nonroot /workspace/ui/ssw-classify/dist ./ui/ssw-classify/dist
COPY --from=builder --chown=nonroot:nonroot /workspace/ui/ssw-timeline/dist ./ui/ssw-timeline/dist
COPY --from=builder --chown=nonroot:nonroot /workspace/ui/ssw-checklist/dist ./ui/ssw-checklist/dist

USER nonroot
EXPOSE 8080

CMD ["dist/index.js"]

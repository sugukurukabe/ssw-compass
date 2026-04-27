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
COPY apps/server/package.json ./apps/server/package.json

RUN pnpm install --frozen-lockfile --filter=@ssw/server...

COPY packages/shared-types ./packages/shared-types
COPY apps/server ./apps/server

# `turbo run build --filter=@ssw/server` builds upstream workspace
# deps first (@ssw/shared-types) per turbo.json `build.dependsOn:
# ["^build"]`, then builds the server itself.
RUN pnpm exec turbo run build --filter=@ssw/server

RUN pnpm deploy --filter=@ssw/server --prod /app

############################################
# Stage 2: runtime (distroless)            #
############################################
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist

USER nonroot
EXPOSE 8080

CMD ["dist/index.js"]

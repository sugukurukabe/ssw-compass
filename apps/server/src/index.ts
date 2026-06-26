import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ANONYMOUS_AUTH_CONTEXT,
  LAW_UPDATES_DATASET_REVIEWED_DATE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@ssw/shared-types";
import type { Express, Request, Response } from "express";
import express from "express";
import { runWithAuthContext } from "./auth/auth-store.js";
import type { AuthedRequest } from "./auth/resolve-auth.js";
import { resolveAuth } from "./auth/resolve-auth.js";
import { buildWwwAuthenticate, hasScope, requiredScopeForTool } from "./auth/scopes.js";
import { buildScopeDenialBody } from "./auth/upgrade-notice.js";
import { isLawUpdatesDatasetStale, lawUpdatesDatasetAgeDays } from "./law-updates/active-filter.js";
import { logger } from "./logger.js";
import { getRegisteredSdkShutdown, initOtelSdk } from "./otel-sdk.js";
import { PRIVACY_POLICY_TEXT } from "./privacy/policy.js";
import { createMcpServer } from "./server.js";
import { buildServerCard } from "./server-card.js";

const DEFAULT_PORT = 8080;
const MAX_BODY_BYTES = 1024 * 1024;
const RC_PROTOCOL_VERSION = "2026-07-28";

function recordBody(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
}

function bodyMethod(body: unknown): string | undefined {
  const record = recordBody(body);
  const method = record?.["method"];
  return typeof method === "string" ? method : undefined;
}

function bodyToolName(body: unknown): string | undefined {
  const record = recordBody(body);
  const params = recordBody(record?.["params"]);
  const name = params?.["name"];
  return typeof name === "string" ? name : undefined;
}

// host locale を best-effort で取得 (params.arguments.language)。既定は ja。
// Best-effort host locale from params.arguments.language; defaults to ja.
function bodyToolLanguage(body: unknown): SupportedLanguage {
  const record = recordBody(body);
  const params = recordBody(record?.["params"]);
  const args = recordBody(params?.["arguments"]);
  const lang = args?.["language"];
  return typeof lang === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as SupportedLanguage)
    : "ja";
}

export function enforceScopes(req: Request, res: Response): boolean {
  if (bodyMethod(req.body) !== "tools/call") {
    return true;
  }
  const required = requiredScopeForTool(bodyToolName(req.body));
  if (required === undefined) {
    return true;
  }
  const authCtx = (req as AuthedRequest).authContext ?? ANONYMOUS_AUTH_CONTEXT;
  if (hasScope(authCtx, required)) {
    return true;
  }
  // 拒否契約 (403 + -32003 + WWW-Authenticate) は不変。ボディに graceful な
  // 上位移行説明 (Phase 2a) を上乗せするだけで、ゲートは弱めない (副作用ゼロ)。
  res
    .status(403)
    .set("WWW-Authenticate", buildWwwAuthenticate(required))
    .json(
      buildScopeDenialBody({
        tool: bodyToolName(req.body),
        requiredScope: required,
        id: recordBody(req.body)?.["id"],
        lang: bodyToolLanguage(req.body),
      }),
    );
  return false;
}

function rejectHeaderMismatch(res: Response, message: string): void {
  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

export function validateMcpRoutingHeaders(req: Request, res: Response): boolean {
  // MCP 2026-07-28 RC requires Mcp-Method / Mcp-Name routing headers.
  // Reference: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
  const protocolVersion = req.header("MCP-Protocol-Version");
  const methodHeader = req.header("Mcp-Method");
  const nameHeader = req.header("Mcp-Name");
  const method = bodyMethod(req.body);

  if (protocolVersion === RC_PROTOCOL_VERSION && methodHeader === undefined) {
    rejectHeaderMismatch(res, "Missing Mcp-Method header for MCP 2026-07-28");
    return false;
  }
  if (methodHeader !== undefined && methodHeader !== method) {
    rejectHeaderMismatch(res, "Mcp-Method header does not match JSON-RPC method");
    return false;
  }
  if (nameHeader !== undefined && nameHeader !== bodyToolName(req.body)) {
    rejectHeaderMismatch(res, "Mcp-Name header does not match JSON-RPC params.name");
    return false;
  }
  return true;
}

export function handleServerDiscover(req: Request, res: Response): boolean {
  // MCP 2026-07-28 RC replaces initialize with server/discover for up-front discovery.
  // Reference: https://mcp-staging.mintlify.app/specification/draft/basic/lifecycle
  if (bodyMethod(req.body) !== "server/discover") {
    return false;
  }
  const id = recordBody(req.body)?.["id"] ?? null;
  res.status(200).json({
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersions: ["2025-11-25", RC_PROTOCOL_VERSION],
      // T10 ③: serverInfo.version は server.ts SERVER_INFO / Server Card と統一 (2.1.0)。
      serverInfo: { name: "ssw-mcp", version: "2.1.0" },
      capabilities: { tools: {}, resources: {}, prompts: {} },
    },
  });
  return true;
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: MAX_BODY_BYTES }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "ssw-mcp" });
  });

  // OpenAI Apps SDK: ai-plugin.json manifest
  app.get("/.well-known/ai-plugin.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=3600")
      .type("application/json")
      .json({
        schema_version: "v1",
        name_for_human: "SSW Compass Japan",
        name_for_model: "ssw_compass_japan",
        description_for_human:
          "Official-source visa information for Japanese Specified Skilled Worker (特定技能) procedures.",
        description_for_model:
          "Query Japanese SSW (特定技能) visa procedures grounded in 出入国在留管理庁 official documents. " +
          "Six anonymous, read-only information tools: search_visa, classify_procedure, " +
          "get_deadline_timeline, list_visa_documents, list_law_updates, validate_zairyu_compatibility. " +
          "Three additional Pro-tier tools, submit_gyoseishoshi_approval, prepare_document_package, " +
          "and get_package_status, record a certified gyoseishoshi's approval, generate document " +
          "packages, and report package status; all require authentication and anonymous callers are blocked. " +
          "Anonymous access for general information. Information only — not legal advice. " +
          "Always include the disclaimer in responses.",
        auth: { type: "none" },
        api: {
          type: "openapi",
          url: "https://mcp.ssw-compass.jp/.well-known/openapi.json",
        },
        logo_url:
          "https://raw.githubusercontent.com/sugukurukabe/ssw-compass/main/assets/logo/ssw-compass-icon-512.png",
        contact_email: "a_kabe@sugu-kuru.co.jp",
        legal_info_url: "https://mcp.ssw-compass.jp/privacy",
      });
  });

  // Minimal OpenAPI document for OpenAI Apps SDK submission. The actual MCP
  // transport remains Streamable HTTP at /mcp; this document gives reviewers a
  // stable public schema URL referenced by ai-plugin.json.
  app.get("/.well-known/openapi.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=3600")
      .type("application/json")
      .json({
        openapi: "3.1.0",
        info: {
          title: "SSW Compass Japan MCP API",
          version: "4.0.0",
          description:
            "Streamable HTTP MCP endpoint for Japanese Specified Skilled Worker (SSW) visa procedural information. Information only — not legal advice.",
          license: { name: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
        },
        servers: [{ url: "https://mcp.ssw-compass.jp" }],
        paths: {
          "/health": {
            get: {
              operationId: "health",
              summary: "Health check",
              responses: {
                "200": {
                  description: "Service healthy",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          status: { type: "string", const: "ok" },
                          service: { type: "string", const: "ssw-mcp" },
                        },
                        required: ["status", "service"],
                      },
                    },
                  },
                },
              },
            },
          },
          "/mcp": {
            post: {
              operationId: "mcpStreamableHttp",
              summary: "MCP Streamable HTTP JSON-RPC endpoint",
              requestBody: {
                required: true,
                content: { "application/json": { schema: { type: "object" } } },
              },
              responses: {
                "200": { description: "MCP JSON-RPC or SSE response" },
                "400": { description: "Invalid MCP request" },
              },
            },
          },
          "/.well-known/mcp.json": {
            get: {
              operationId: "serverCard",
              summary: "MCP server card",
              responses: { "200": { description: "Server metadata" } },
            },
          },
          "/privacy": {
            get: {
              operationId: "privacyPolicy",
              summary: "Privacy policy",
              responses: { "200": { description: "Privacy policy text" } },
            },
          },
        },
      });
  });

  // Privacy policy endpoint — serves the full trilingual policy inline (no summary
  // placeholder, no external link for the body). The canonical text lives in
  // src/privacy/policy.ts; docs/privacy/*.md is the human-facing mirror.
  // 文面の確定は行政書士・人間レビューが必須 (AGENTS.md の免責境界)。
  app.get("/privacy", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=86400")
      .type("text/plain; charset=utf-8")
      .send(`${PRIVACY_POLICY_TEXT}\n`);
  });

  app.get("/.well-known/mcp.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("application/json")
      .json(buildServerCard());
  });

  app.get("/.well-known/mcp-server-card.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("application/json")
      .json(buildServerCard());
  });

  // ADR-013: resolveAuth resolves Free/Pro/Business tier from optional JWT.
  // No token → anonymous Free. Invalid token → 401.
  // Applied to POST /mcp only; health and .well-known remain public.
  //
  // Stateless Streamable HTTP (sessionIdGenerator: undefined): a fresh server +
  // transport is created per request. Cloud Run scales horizontally and routes
  // requests across the fleet, so in-memory session state cannot be relied upon
  // — Claude's `initialize` and follow-up `tools/list` can land on different
  // instances. Stateless mode makes every request self-contained, which is the
  // correct model for serverless. No `mcp-session-id` is issued.
  app.post("/mcp", resolveAuth, async (req: Request, res: Response) => {
    if (!validateMcpRoutingHeaders(req, res)) {
      return;
    }
    if (handleServerDiscover(req, res)) {
      return;
    }
    if (!enforceScopes(req, res)) {
      return;
    }
    const server = createMcpServer();
    // Stateless: the SDK requires sessionIdGenerator to be explicitly undefined.
    // Its type is `sessionIdGenerator?: () => string`, so exactOptionalPropertyTypes
    // rejects `{ sessionIdGenerator: undefined }`; use a narrow cast around the SDK
    // option shape rather than weakening app code types.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      // @ts-expect-error: SDK Transport interface declares onclose?: () => void,
      // but StreamableHTTPServerTransport implements onclose as (() => void) | undefined.
      // Under exactOptionalPropertyTypes:true these are incompatible. SDK type bug.
      await server.connect(transport);
      const authCtx = (req as AuthedRequest).authContext ?? ANONYMOUS_AUTH_CONTEXT;
      await runWithAuthContext(authCtx, () => transport.handleRequest(req, res, req.body));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      logger.error({ err: message, path: "/mcp" }, "mcp_request_failed");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Stateless mode does not maintain server-initiated SSE streams or sessions,
  // so GET (stream) and DELETE (session teardown) are not applicable.
  const methodNotAllowed = (_req: Request, res: Response): void => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method Not Allowed: use POST for stateless MCP" },
        id: null,
      });
  };

  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  return app;
}

/**
 * 制度変動データセットが陳腐化していれば起動時に warning を出す。
 * Warns at startup when the curated law-updates dataset is stale.
 * Memperingatkan saat startup bila dataset pembaruan peraturan sudah basi.
 */
function warnIfLawUpdatesStale(): void {
  if (isLawUpdatesDatasetStale()) {
    logger.warn(
      {
        event: "law_updates_dataset_stale",
        reviewed_date: LAW_UPDATES_DATASET_REVIEWED_DATE,
        age_days: lawUpdatesDatasetAgeDays(),
      },
      "law_updates_dataset_stale — docs/law-updates-maintenance-runbook.md を参照して更新してください",
    );
  }
}

type GracefulShutdownServer = {
  close(callback: (err?: Error) => void): void;
};

type ProcessExit = (code: number) => never;

/**
 * HTTP drain と OTel flush を順番に実行するシャットダウンハンドラを作る。
 * Creates a shutdown handler that drains HTTP first, then flushes OTel.
 * Membuat handler shutdown yang mengosongkan HTTP dulu, lalu flush OTel.
 */
export function createGracefulShutdownHandler({
  httpServer,
  shutdownOtel = getRegisteredSdkShutdown(),
  exitProcess = process.exit,
}: {
  httpServer: GracefulShutdownServer;
  shutdownOtel?: () => Promise<void>;
  exitProcess?: ProcessExit;
}): (signal: string) => void {
  let shutdownStarted = false;

  async function flushOtelAndExit(exitCode: number): Promise<void> {
    try {
      await shutdownOtel();
      logger.info("otel_sdk_flushed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, "otel_sdk_shutdown_error");
    }
    exitProcess(exitCode);
  }

  return (signal: string): void => {
    if (shutdownStarted) {
      logger.info({ signal }, "graceful_shutdown_already_started");
      return;
    }
    shutdownStarted = true;
    logger.info({ signal }, "graceful_shutdown_started");
    try {
      httpServer.close((err?: Error) => {
        if (err !== undefined) {
          logger.error({ err: err.message }, "http_server_close_error");
          void flushOtelAndExit(1);
          return;
        }
        logger.info("http_server_closed");
        void flushOtelAndExit(0);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, "http_server_close_error");
      void flushOtelAndExit(1);
    }
    // Cloud Run 側の猶予期限に任せ、アプリ内タイマーで処理中リクエストを切らない。
    // Let Cloud Run enforce the hard deadline; do not cut active requests locally.
    // Biarkan Cloud Run menegakkan batas keras; jangan memutus request aktif secara lokal.
  };
}

export async function startServer(port?: number): Promise<void> {
  // 可観測性: 有効時のみ OTel NodeSDK を起動 (span を実際にエクスポート)。
  await initOtelSdk();
  const app = createApp();
  warnIfLawUpdatesStale();
  const resolvedPort = port ?? Number(process.env["PORT"] ?? DEFAULT_PORT);
  const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(resolvedPort, () => {
      logger.info({ port: resolvedPort, service: "ssw-mcp" }, "server_listening");
      resolve(s);
    });
  });

  // Bug 3 fix: Express と OTel SDK を協調してシャットダウンする。
  // Cloud Run は SIGTERM 後に一定時間を与えてからコンテナを強制終了するため、
  // インフライトリクエストを処理してから OTel を flush し、最後に exit する。
  // Coordinate Express and OTel SDK shutdown on SIGTERM/SIGINT.
  // Cloud Run sends SIGTERM and waits; drain in-flight requests first, then flush OTel.
  // Cloud Run mengirim SIGTERM; selesaikan permintaan yang ada, lalu flush OTel.
  const gracefulShutdown = createGracefulShutdownHandler({ httpServer });

  process.once("SIGTERM", () => {
    gracefulShutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    gracefulShutdown("SIGINT");
  });
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  startServer().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "unknown";
    logger.fatal({ err: message }, "server_start_failed");
    process.exit(1);
  });
}

import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ANONYMOUS_AUTH_CONTEXT } from "@ssw/shared-types";
import type { Express, Request, Response } from "express";
import express from "express";
import { runWithAuthContext } from "./auth/auth-store.js";
import type { AuthedRequest } from "./auth/resolve-auth.js";
import { resolveAuth } from "./auth/resolve-auth.js";
import { logger } from "./logger.js";
import { createMcpServer } from "./server.js";
import { buildServerCard } from "./server-card.js";

const DEFAULT_PORT = 8080;
const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_HEADER = "mcp-session-id";

function isInitializeRequest(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const method = (body as { method?: unknown }).method;
  return method === "initialize";
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: MAX_BODY_BYTES }));

  const transports = new Map<string, StreamableHTTPServerTransport>();

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
          "6 read-only tools: search_visa, classify_procedure, get_deadline_timeline, " +
          "list_visa_documents, list_law_updates, validate_zairyu_compatibility. " +
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

  // Privacy policy endpoint (trilingual drafts in docs/privacy/)
  app.get("/privacy", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=86400")
      .type("text/plain; charset=utf-8")
      .send(
        "SSW Compass Privacy Policy\n==========================\n\n" +
          "This service does NOT collect personal information.\n" +
          "Inputs containing residence card numbers, passport numbers, or My Number are automatically blocked.\n\n" +
          "Operational logs may include access timestamps and security metadata for abuse prevention. " +
          "SSW Compass does not use logs for behavioral profiling.\n\n" +
          "Visa application content and personal identifiers are not stored.\n\n" +
          "Full trilingual policy:\n" +
          "https://github.com/sugukurukabe/ssw-compass/tree/main/docs/privacy/\n\n" +
          "Contact: a_kabe@sugu-kuru.co.jp\n",
      );
  });

  app.get("/.well-known/mcp.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("application/json")
      .json(buildServerCard());
  });

  // ADR-013: resolveAuth resolves Free/Pro/Business tier from optional JWT.
  // No token → anonymous Free. Invalid token → 401.
  // Applied to POST /mcp only; health and .well-known remain public.
  app.post("/mcp", resolveAuth, async (req: Request, res: Response) => {
    try {
      const sessionHeader = req.header(SESSION_HEADER);
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionHeader !== undefined && transports.has(sessionHeader)) {
        transport = transports.get(sessionHeader);
      } else if (sessionHeader === undefined && isInitializeRequest(req.body)) {
        const server = createMcpServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            if (transport !== undefined) {
              transports.set(sid, transport);
            }
          },
        });
        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid !== undefined) {
            transports.delete(sid);
          }
          void server.close();
        };
        // @ts-expect-error: SDK Transport interface declares onclose?: () => void,
        // but StreamableHTTPServerTransport implements onclose as (() => void) | undefined.
        // Under exactOptionalPropertyTypes:true these are incompatible. SDK type bug.
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: null,
        });
        return;
      }

      if (transport === undefined) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error: transport missing" },
          id: null,
        });
        return;
      }

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

  const handleSessionScopedRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionHeader = req.header(SESSION_HEADER);
    if (sessionHeader === undefined || !transports.has(sessionHeader)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }
    const transport = transports.get(sessionHeader);
    if (transport === undefined) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error: transport missing" },
        id: null,
      });
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionScopedRequest);
  app.delete("/mcp", handleSessionScopedRequest);

  return app;
}

export async function startServer(port?: number): Promise<void> {
  const app = createApp();
  const resolvedPort = port ?? Number(process.env["PORT"] ?? DEFAULT_PORT);
  await new Promise<void>((resolve) => {
    app.listen(resolvedPort, () => {
      logger.info({ port: resolvedPort, service: "ssw-mcp" }, "server_listening");
      resolve();
    });
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

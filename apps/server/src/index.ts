import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express, Request, Response } from "express";
import express from "express";
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

  app.get("/.well-known/mcp.json", (_req: Request, res: Response) => {
    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("application/json")
      .json(buildServerCard());
  });

  app.post("/mcp", async (req: Request, res: Response) => {
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

      await transport.handleRequest(req, res, req.body);
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

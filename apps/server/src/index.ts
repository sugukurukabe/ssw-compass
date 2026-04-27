import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express, Request, Response } from "express";
import express from "express";
import { logger } from "./logger.js";
import { createMcpServer } from "./server.js";

const DEFAULT_PORT = 3001;
const MAX_BODY_BYTES = 1024 * 1024;

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: MAX_BODY_BYTES }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "vcj-mcp" });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      // @ts-expect-error: SDK Transport interface declares onclose?: () => void,
      // but StreamableHTTPServerTransport implements onclose as (() => void) | undefined.
      // Under exactOptionalPropertyTypes:true these are incompatible. SDK type bug.
      await server.connect(transport);
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

  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method Not Allowed: use POST" },
      id: null,
    });
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method Not Allowed" },
      id: null,
    });
  });

  return app;
}

export async function startServer(port?: number): Promise<void> {
  const app = createApp();
  const resolvedPort = port ?? Number(process.env["PORT"] ?? DEFAULT_PORT);
  await new Promise<void>((resolve) => {
    app.listen(resolvedPort, () => {
      logger.info({ port: resolvedPort, service: "vcj-mcp" }, "server_listening");
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

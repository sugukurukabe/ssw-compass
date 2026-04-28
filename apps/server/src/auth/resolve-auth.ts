/**
 * Express ミドルウェア: AuthContext を req に attach する
 * Express middleware: attaches AuthContext to the request
 * Middleware Express: melampirkan AuthContext ke permintaan
 *
 * Interface Freeze (ADR-013): resolveAuth ミドルウェアの動作は Sprint 4 不変。
 * - No Bearer token → ANONYMOUS_AUTH_CONTEXT (Free tier)
 * - Valid JWT → decoded AuthContext
 * - Invalid JWT → 401 (no tool handler reached)
 *
 * 適用対象: POST /mcp のみ (health / .well-known は public)
 * Applied to: POST /mcp only (health / .well-known are public)
 * Diterapkan pada: POST /mcp saja (health / .well-known bersifat publik)
 */

import type { AuthContextType as AuthContext } from "@ssw/shared-types";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger.js";
import { extractBearerToken, getTokenVerifier } from "./token-verifier.js";

declare module "express-serve-static-core" {
  interface Request {
    authContext?: AuthContext;
  }
}

export async function resolveAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("Authorization");
  const token = extractBearerToken(authHeader);
  const verifier = getTokenVerifier();

  let ctx: AuthContext | null;
  try {
    ctx = await verifier.verify(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error({ err: message, event: "auth_resolve_error" }, "auth_resolve_error");
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Internal server error" },
      id: null,
    });
    return;
  }

  if (ctx === null) {
    // Token present but invalid (expired, bad signature, etc.)
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: invalid or expired token" },
      id: null,
    });
    return;
  }

  req.authContext = ctx;
  next();
}

/**
 * handler 内から AuthContext を取得するヘルパー
 * Helper to retrieve AuthContext inside a handler
 * Helper untuk mengambil AuthContext di dalam handler
 *
 * tool handler はこれを通じて tier / gyoseishoshi_verified を参照する。
 */
export function getAuthContext(req: Request): AuthContext {
  const ctx = req.authContext;
  if (ctx === undefined) {
    // Should never happen if resolveAuth middleware is applied correctly.
    throw new Error(
      "AuthContext not resolved — resolveAuth middleware must run before this handler",
    );
  }
  return ctx;
}

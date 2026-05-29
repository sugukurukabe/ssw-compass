/**
 * リクエストスコープの AuthContext を AsyncLocalStorage で伝搬する。
 * Propagate request-scoped AuthContext via AsyncLocalStorage.
 * Menyebarkan AuthContext per-permintaan melalui AsyncLocalStorage.
 *
 * Express ミドルウェア (resolveAuth) が設定した AuthContext を
 * MCP SDK のツールハンドラから参照できるようにする。
 * Enables MCP SDK tool handlers to access the AuthContext set by
 * the Express middleware (resolveAuth).
 * Memungkinkan handler alat MCP SDK mengakses AuthContext yang
 * di-set oleh middleware Express (resolveAuth).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { ANONYMOUS_AUTH_CONTEXT, type AuthContextType } from "@ssw/shared-types";

const authStore = new AsyncLocalStorage<AuthContextType>();

export function runWithAuthContext<T>(ctx: AuthContextType, fn: () => T): T {
  return authStore.run(ctx, fn);
}

export function getRequestAuthContext(): AuthContextType {
  return authStore.getStore() ?? ANONYMOUS_AUTH_CONTEXT;
}

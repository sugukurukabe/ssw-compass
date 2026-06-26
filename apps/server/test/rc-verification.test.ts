/**
 * T10-A: RC 機能の検証・回帰テスト。
 *
 * 目的: RC (2026-07-28) のデュアル構成における「現挙動」を固定して回帰を防ぐ。
 * - initialize ネゴシエーションは **SDK 既定ネゴシエーション依存** であり、自前分岐は無い。
 *   RC 非対応クライアント (安定版要求) には 2025-11-25 を返し、RC 版 (2026-07-28) を
 *   要求するクライアントにも 2025-11-25 を返す (SDK の SUPPORTED_PROTOCOL_VERSIONS に
 *   2026-07-28 は含まれないため LATEST=2025-11-25 にフォールバック)。本テストはこの
 *   挙動を固定するもので、フォールバック分岐を新設する意図はない。
 * - Server Card / server/discover / .well-known のデュアル広告が互いに矛盾しないこと。
 * - ステートレス (POST 自己完結 / GET・DELETE 405 / mcp-session-id 非発行)。
 * - キャッシュ tier (ttlMs / cacheScope) の不変条件。
 *
 * T10-A: RC feature verification / regression tests (lock current behavior).
 * T10-A: tes verifikasi / regresi fitur RC (mengunci perilaku saat ini).
 */

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CACHE_TIERS } from "../src/cache.js";
import { createApp } from "../src/index.js";
import { buildServerCard } from "../src/server-card.js";

// POST /mcp は resolveAuth (getTokenVerifier) を通る。匿名 (Free) モードで HTTP 統合
// テストを行う。getTokenVerifier はリクエスト時に env を遅延読みするため、最初の
// リクエスト前に設定すれば足りる (本番の匿名読み取り経路と同じ挙動)。
process.env["SSW_AUTH_MODE"] = "anonymous";

const STABLE_VERSION = "2025-11-25";
const RC_VERSION = "2026-07-28";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

/**
 * SSE または素の JSON のどちらでも JSON-RPC ペイロードを取り出す。
 * StreamableHTTP (enableJsonResponse=false) は initialize を SSE で返すため、
 * `data:` 行から JSON を抽出する。server/discover は res.json の素 JSON。
 */
function parseJsonRpc(text: string): JsonRpcResponse {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as JsonRpcResponse;
  }
  const dataPayload = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("");
  if (dataPayload.length === 0) {
    throw new Error(`no JSON-RPC payload found in response: ${text}`);
  }
  return JSON.parse(dataPayload) as JsonRpcResponse;
}

type PostResult = { status: number; headers: Headers; body: JsonRpcResponse };

async function postMcp(
  baseUrl: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<PostResult> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // StreamableHTTP は POST に application/json と text/event-stream の両方を要求する。
      accept: "application/json, text/event-stream",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: parseJsonRpc(text) };
}

function initializeRequest(protocolVersion: string): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "rc-verification-test", version: "0.0.0" },
    },
  };
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp();
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s as Server));
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("initialize negotiation (SDK-default fallback, current behavior locked)", () => {
  it("echoes the stable version to an RC-incapable client (2025-11-25 → 2025-11-25)", async () => {
    const { status, body } = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    expect(status).toBe(200);
    expect(body.result?.["protocolVersion"]).toBe(STABLE_VERSION);
  });

  it("falls back to 2025-11-25 when an RC client requests 2026-07-28 (SDK has no 2026-07-28)", async () => {
    // RC 2026-07-28 は SDK の SUPPORTED_PROTOCOL_VERSIONS に無いため、initialize 層では
    // 必ず安定版 2025-11-25 にフォールバックする。RC 機能は server/discover + ルーティング
    // ヘッダの上乗せで提供され、initialize の protocolVersion では交渉されない。
    const { status, body } = await postMcp(baseUrl, initializeRequest(RC_VERSION));
    expect(status).toBe(200);
    expect(body.result?.["protocolVersion"]).toBe(STABLE_VERSION);
  });

  it("still negotiates 2025-11-25 even when RC routing headers are present", async () => {
    const { status, body } = await postMcp(baseUrl, initializeRequest(RC_VERSION), {
      "MCP-Protocol-Version": RC_VERSION,
      "Mcp-Method": "initialize",
    });
    expect(status).toBe(200);
    expect(body.result?.["protocolVersion"]).toBe(STABLE_VERSION);
  });

  it("echoes an older SDK-supported version when requested (2025-06-18)", async () => {
    const { status, body } = await postMcp(baseUrl, initializeRequest("2025-06-18"));
    expect(status).toBe(200);
    expect(body.result?.["protocolVersion"]).toBe("2025-06-18");
  });

  it("advertises prompts capability in the initialize result", async () => {
    const { body } = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    const capabilities = body.result?.["capabilities"] as Record<string, unknown> | undefined;
    expect(capabilities).toBeDefined();
    expect(capabilities?.["prompts"]).toBeDefined();
  });

  it("reports serverInfo.version unified to the Server Card version (2.1.0)", async () => {
    const { body } = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    const serverInfo = body.result?.["serverInfo"] as Record<string, unknown> | undefined;
    expect(serverInfo?.["name"]).toBe("ssw-mcp");
    expect(serverInfo?.["version"]).toBe(buildServerCard().version);
    expect(serverInfo?.["version"]).toBe("2.1.0");
  });
});

describe("dual advertisement consistency (server/discover ↔ Server Card ↔ .well-known)", () => {
  it("server/discover protocolVersions matches the Server Card dual advertisement", async () => {
    const { status, body } = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "server/discover",
      params: {},
    });
    expect(status).toBe(200);
    const card = buildServerCard();
    expect(body.result?.["protocolVersions"]).toEqual(card.protocolVersions);
    expect(body.result?.["protocolVersions"]).toEqual([STABLE_VERSION, RC_VERSION]);
  });

  it("server/discover serverInfo.version matches the Server Card version", async () => {
    const { body } = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "server/discover",
      params: {},
    });
    const serverInfo = body.result?.["serverInfo"] as Record<string, unknown> | undefined;
    expect(serverInfo?.["version"]).toBe(buildServerCard().version);
  });

  it("server/discover advertises prompts while the Server Card declares prompts:true", async () => {
    const { body } = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 4,
      method: "server/discover",
      params: {},
    });
    const capabilities = body.result?.["capabilities"] as Record<string, unknown> | undefined;
    expect(capabilities?.["prompts"]).toBeDefined();
    expect(buildServerCard().capabilities.prompts).toBe(true);
  });

  it("both .well-known Server Card endpoints serve identical, consistent documents", async () => {
    const primary = await fetch(`${baseUrl}/.well-known/mcp.json`);
    const alias = await fetch(`${baseUrl}/.well-known/mcp-server-card.json`);
    expect(primary.status).toBe(200);
    expect(alias.status).toBe(200);
    const primaryBody = (await primary.json()) as ReturnType<typeof buildServerCard>;
    const aliasBody = (await alias.json()) as ReturnType<typeof buildServerCard>;
    expect(primaryBody).toEqual(aliasBody);
    expect(primaryBody).toEqual(buildServerCard());
    expect(primaryBody.protocolVersions).toEqual([STABLE_VERSION, RC_VERSION]);
    expect(primaryBody.capabilities.prompts).toBe(true);
    expect(primaryBody.version).toBe("2.1.0");
  });
});

describe("stateless transport (no hidden per-connection state)", () => {
  it("rejects GET /mcp with 405 and Allow: POST", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "GET" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("rejects DELETE /mcp with 405 and Allow: POST", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "DELETE" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("does not issue an mcp-session-id on initialize (stateless)", async () => {
    const { headers } = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    expect(headers.get("mcp-session-id")).toBeNull();
  });

  it("treats each POST as self-contained — two independent initialize calls both succeed", async () => {
    const first = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    const second = await postMcp(baseUrl, initializeRequest(STABLE_VERSION));
    expect(first.body.result?.["protocolVersion"]).toBe(STABLE_VERSION);
    expect(second.body.result?.["protocolVersion"]).toBe(STABLE_VERSION);
  });
});

describe("cache tier invariants (ttlMs / cacheScope)", () => {
  it("every cache tier declares a numeric ttlMs and a public/private scope", () => {
    for (const [name, tier] of Object.entries(CACHE_TIERS)) {
      expect(typeof tier.ttlMs, `${name}.ttlMs`).toBe("number");
      expect(tier.ttlMs, `${name}.ttlMs`).toBeGreaterThanOrEqual(0);
      expect(["public", "private"], `${name}.cacheScope`).toContain(tier.cacheScope);
    }
  });

  it("locks the three tier values (public-day / public-hour / private-no-store)", () => {
    expect(CACHE_TIERS.A_PUBLIC_DAY).toEqual({ ttlMs: 86_400_000, cacheScope: "public" });
    expect(CACHE_TIERS.B_PUBLIC_HOUR).toEqual({ ttlMs: 3_600_000, cacheScope: "public" });
    expect(CACHE_TIERS.C_PRIVATE_NO_STORE).toEqual({ ttlMs: 0, cacheScope: "private" });
  });
});

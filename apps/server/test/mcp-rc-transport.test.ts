import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { handleServerDiscover, validateMcpRoutingHeaders } from "../src/index.js";

function makeReq(input: { body: unknown; headers?: Record<string, string> }): Request {
  return {
    body: input.body,
    header: (name: string) => input.headers?.[name] ?? input.headers?.[name.toLowerCase()],
  } as unknown as Request;
}

function makeRes(): { res: Response; holder: { status?: number; body?: unknown } } {
  const holder: { status?: number; body?: unknown } = {};
  const res = {
    status: (status: number) => {
      holder.status = status;
      return res;
    },
    json: (body: unknown) => {
      holder.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, holder };
}

describe("MCP 2026-07-28 transport adapter", () => {
  it("rejects Mcp-Name mismatches with 400", () => {
    const req = makeReq({
      body: { jsonrpc: "2.0", method: "tools/call", params: { name: "search_visa" } },
      headers: { "Mcp-Method": "tools/call", "Mcp-Name": "classify_procedure" },
    });
    const { res, holder } = makeRes();

    expect(validateMcpRoutingHeaders(req, res)).toBe(false);
    expect(holder.status).toBe(400);
  });

  it("requires Mcp-Method for the RC protocol version", () => {
    const req = makeReq({
      body: { jsonrpc: "2.0", method: "tools/call", params: { name: "search_visa" } },
      headers: { "MCP-Protocol-Version": "2026-07-28" },
    });
    const { res, holder } = makeRes();

    expect(validateMcpRoutingHeaders(req, res)).toBe(false);
    expect(holder.status).toBe(400);
  });

  it("returns server/discover capabilities", () => {
    const req = makeReq({
      body: { jsonrpc: "2.0", id: 1, method: "server/discover", params: {} },
    });
    const { res, holder } = makeRes();

    expect(handleServerDiscover(req, res)).toBe(true);
    expect(holder.status).toBe(200);
    expect(holder.body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        serverInfo: { name: "ssw-mcp" },
      },
    });
  });
});

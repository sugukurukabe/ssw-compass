import { describe, expect, it, vi } from "vitest";
import { explainBlock, safeFetch } from "../../src/safety/url-guard.js";

/**
 * url-guard.safeFetch coverage — Sprint 3 Batch 6.
 *
 * Mocks the global fetch so allowed calls return a fake 200 and we
 * assert the guard either called through or threw egress_blocked
 * with the expected structured reason.
 */

function makeFetchMock() {
  return vi.fn(async () => new Response("ok", { status: 200 }));
}

describe("safeFetch — allowlist hits (must pass through to fetch)", () => {
  it("allows discoveryengine.googleapis.com subdomain (Vertex AI Search)", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const r = await safeFetch("https://discoveryengine.googleapis.com/v1/...");
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("allows secretmanager.googleapis.com", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://secretmanager.googleapis.com/v1/projects/x/secrets/y");
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("allows cloud.google.com top-level (OAuth / IAM endpoints)", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://cloud.google.com/iam");
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("allows www.moj.go.jp — government subdomain (Sprint 4 ingest)", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://www.moj.go.jp/isa/");
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("allows nested mlit.go.jp subdomain", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await safeFetch("https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/");
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("safeFetch — host_not_allowlisted", () => {
  it("blocks example.com", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://example.com/foo")).rejects.toThrow(
      /egress_blocked: host_not_allowlisted/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("blocks bare go.jp root (must be a subdomain to pass)", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://go.jp/")).rejects.toThrow(
      /egress_blocked: host_not_allowlisted/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("blocks look-alike googleapiscom.evil.com", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://googleapiscom.evil.com/")).rejects.toThrow(
      /egress_blocked: host_not_allowlisted/,
    );
    vi.unstubAllGlobals();
  });

  it("blocks attacker-controlled subdomain googleapis.com.evil.com", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://googleapis.com.evil.com/")).rejects.toThrow(
      /egress_blocked: host_not_allowlisted/,
    );
    vi.unstubAllGlobals();
  });
});

describe("safeFetch — non_https", () => {
  it("blocks http:// even for allowlisted hostname", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("http://www.moj.go.jp/isa/")).rejects.toThrow(
      /egress_blocked: non_https/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("blocks file:// and other schemes", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/egress_blocked: non_https/);
    vi.unstubAllGlobals();
  });
});

describe("safeFetch — invalid_url", () => {
  it("rejects malformed input with invalid_url reason", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    let thrown: unknown;
    try {
      await safeFetch("not a url");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const explained = explainBlock(thrown);
    expect(explained?.reason).toBe("invalid_url");
    vi.unstubAllGlobals();
  });
});

describe("explainBlock", () => {
  it("returns null for non-safeFetch errors", () => {
    expect(explainBlock(new Error("something else"))).toBeNull();
    expect(explainBlock(undefined)).toBeNull();
    expect(explainBlock(null)).toBeNull();
  });

  it("extracts structured reason from a safeFetch throw", async () => {
    let err: unknown;
    try {
      await safeFetch("https://evil.example.com/");
    } catch (e) {
      err = e;
    }
    expect(explainBlock(err)).toMatchObject({
      reason: "host_not_allowlisted",
      host: "evil.example.com",
    });
  });
});

/**
 * T12: OpenAI Apps SDK widget CSP の宣言を検証する。
 * T12: Verifies the OpenAI Apps SDK widget CSP declaration.
 * T12: Memverifikasi deklarasi CSP widget OpenAI Apps SDK.
 *
 * 検証する受け入れ条件 (master-plan T12):
 * - UI 有効ツールの resource `_meta` に `openai/widgetCSP` が宣言される。
 * - redirect / connect / resource ドメインが許可リスト内であること
 *   (redirect = 外部 Pro origin のみ、connect/resource = 既存 ui.csp と整合 = 空)。
 * - 既存の `_meta.ui.csp` (MCP/Anthropic 系) が温存され、両ホスト併記であること。
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRO_UPGRADE_URL, proRedirectDomains } from "../../src/auth/upgrade-notice.js";
import { buildOpenAiWidgetCsp, buildWidgetResourceMeta } from "../../src/tools/widget-csp.js";

// loadUiHtml はビルド済み dist を読むため、unit test では固定文字列にモックする。
// loadUiHtml reads the built dist, so it is mocked with a fixed string in unit tests.
// loadUiHtml membaca dist hasil build, jadi di-mock dengan string tetap pada unit test.
vi.mock("../../src/ui-assets.js", () => ({
  loadUiHtml: vi.fn(async () => "<html><body></body></html>"),
}));

interface ResourceContents {
  contents: Array<{ _meta?: Record<string, unknown> }>;
}

interface CapturedResource {
  name: string;
  uri: string;
  read: () => Promise<ResourceContents>;
}

const captured: CapturedResource[] = [];

// registerAppResource を捕捉し、read callback が返す `_meta` を検査できるようにする。
// Capture registerAppResource so the `_meta` returned by the read callback can be inspected.
// Menangkap registerAppResource agar `_meta` dari read callback bisa diperiksa.
vi.mock("@modelcontextprotocol/ext-apps/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modelcontextprotocol/ext-apps/server")>();
  return {
    ...actual,
    registerAppResource: (
      _server: unknown,
      name: string,
      uri: string,
      _meta: unknown,
      read: () => Promise<ResourceContents>,
    ) => {
      captured.push({ name, uri, read });
    },
  };
});

import { registerClassifyProcedureUiResource } from "../../src/tools/classify-procedure/ui.js";
import { registerGetDeadlineTimelineUiResource } from "../../src/tools/get-deadline-timeline/ui.js";
import { registerListVisaDocumentsUiResource } from "../../src/tools/list-visa-documents/ui.js";
import { registerSearchVisaUiResource } from "../../src/tools/search-visa/ui.js";
import { registerValidateZairyuCompatibilityUiResource } from "../../src/tools/validate-zairyu-compatibility/ui.js";

const ALLOWED_REDIRECT_DOMAINS = [new URL(DEFAULT_PRO_UPGRADE_URL).origin];

function isHttpsOrigin(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

describe("buildOpenAiWidgetCsp / buildWidgetResourceMeta (T12)", () => {
  it("declares only the external Pro origin in redirect_domains (within allowlist, https)", () => {
    const csp = buildOpenAiWidgetCsp();
    expect(csp.redirect_domains).toEqual(ALLOWED_REDIRECT_DOMAINS);
    expect(csp.redirect_domains).toEqual(proRedirectDomains());
    for (const domain of csp.redirect_domains) {
      expect(ALLOWED_REDIRECT_DOMAINS).toContain(domain);
      expect(isHttpsOrigin(domain)).toBe(true);
      expect(domain).not.toContain("*");
    }
  });

  it("keeps connect/resource consistent with the existing empty ui.csp (no external fetch)", () => {
    const meta = buildWidgetResourceMeta();
    const openai = meta["openai/widgetCSP"];
    // OpenAI 側の connect/resource は ui.csp と整合 (重複宣言で両ホスト対応)。
    expect(openai.connect_domains).toEqual(meta.ui.csp.connectDomains);
    expect(openai.resource_domains).toEqual(meta.ui.csp.resourceDomains);
    expect(openai.connect_domains).toEqual([]);
    expect(openai.resource_domains).toEqual([]);
  });

  it("co-declares the legacy MCP/Anthropic ui.csp shape (dual-host)", () => {
    const meta = buildWidgetResourceMeta();
    expect(meta.ui.prefersBorder).toBe(true);
    expect(meta.ui.csp).toEqual({
      connectDomains: [],
      resourceDomains: [],
      frameDomains: [],
      baseUriDomains: [],
    });
  });
});

describe("UI resource registrations declare openai/widgetCSP (T12)", () => {
  const registrars = [
    registerSearchVisaUiResource,
    registerClassifyProcedureUiResource,
    registerGetDeadlineTimelineUiResource,
    registerListVisaDocumentsUiResource,
    registerValidateZairyuCompatibilityUiResource,
  ];

  it("every UI widget resource carries ui.csp + openai/widgetCSP with allowlisted domains", async () => {
    captured.length = 0;
    const server = {} as unknown as McpServer;
    for (const register of registrars) {
      register(server);
    }

    // 5 ツール × (canonical + legacy URI) = 10 リソース登録。
    expect(captured.length).toBe(registrars.length * 2);

    for (const resource of captured) {
      const result = await resource.read();
      const meta = result.contents[0]?._meta;
      expect(meta, `missing _meta for ${resource.name}`).toBeDefined();

      // MCP/Anthropic 系 ui.csp が温存されていること。
      const ui = meta?.["ui"] as { csp?: Record<string, unknown> } | undefined;
      expect(ui?.csp, `missing ui.csp for ${resource.name}`).toBeDefined();

      // OpenAI 系 widget CSP が宣言されていること。
      const openai = meta?.["openai/widgetCSP"] as
        | { connect_domains?: string[]; resource_domains?: string[]; redirect_domains?: string[] }
        | undefined;
      expect(openai, `missing openai/widgetCSP for ${resource.name}`).toBeDefined();
      expect(openai?.redirect_domains).toEqual(ALLOWED_REDIRECT_DOMAINS);

      // すべての宣言ドメインが許可リスト内 (connect/resource は空集合 = 部分集合)。
      for (const domain of openai?.connect_domains ?? []) {
        expect([]).toContain(domain);
      }
      for (const domain of openai?.resource_domains ?? []) {
        expect([]).toContain(domain);
      }
      for (const domain of openai?.redirect_domains ?? []) {
        expect(ALLOWED_REDIRECT_DOMAINS).toContain(domain);
        expect(isHttpsOrigin(domain)).toBe(true);
      }
    }
  });
});

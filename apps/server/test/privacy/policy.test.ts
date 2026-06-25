import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/index.js";
import {
  PRIVACY_POLICY_CONTACT,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_TEXT,
  REQUIRED_PRIVACY_SECTIONS,
} from "../../src/privacy/policy.js";

// プレースホルダ/要約配信の痕跡。完全版にはこれらが含まれてはならない。
// Placeholder / summary-delivery markers. The full version must contain none of these.
// Penanda placeholder / pengiriman ringkasan. Versi lengkap tidak boleh memuat ini.
const PLACEHOLDER_MARKERS = [
  "Full trilingual policy",
  "github.com/sugukurukabe/ssw-compass/tree",
  "placeholder",
  "Placeholder",
  "PLACEHOLDER",
  "TODO",
  "TBD",
  "for reference purposes only",
  "参考目的のみ",
];

describe("privacy policy text (full version)", () => {
  it("includes every required trilingual section", () => {
    for (const section of REQUIRED_PRIVACY_SECTIONS) {
      expect(PRIVACY_POLICY_TEXT, `missing section: ${section}`).toContain(section);
    }
  });

  it("contains no placeholder or summary-link markers", () => {
    for (const marker of PLACEHOLDER_MARKERS) {
      expect(PRIVACY_POLICY_TEXT, `placeholder marker present: ${marker}`).not.toContain(marker);
    }
  });

  it("states the 7-year WORM audit retention and PII-not-stored stance", () => {
    expect(PRIVACY_POLICY_TEXT).toContain("7 年");
    expect(PRIVACY_POLICY_TEXT).toContain("7 years");
    expect(PRIVACY_POLICY_TEXT).toContain("7 tahun");
    expect(PRIVACY_POLICY_TEXT).toContain("WORM");
  });

  it("keeps the §19 information-only legal posture", () => {
    expect(PRIVACY_POLICY_TEXT).toContain("行政書士");
    expect(PRIVACY_POLICY_TEXT).toContain("Gyoseishoshi Act Article 19");
    expect(PRIVACY_POLICY_TEXT).toContain("行政書士レビュー要");
  });

  it("includes the contact address and a last-updated date", () => {
    expect(PRIVACY_POLICY_TEXT).toContain(PRIVACY_POLICY_CONTACT);
    expect(PRIVACY_POLICY_TEXT).toContain(PRIVACY_POLICY_LAST_UPDATED);
  });
});

describe("GET /privacy", () => {
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

  it("returns 200 text/plain with the full policy body", async () => {
    const res = await fetch(`${baseUrl}/privacy`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    for (const section of REQUIRED_PRIVACY_SECTIONS) {
      expect(body, `endpoint missing section: ${section}`).toContain(section);
    }
    for (const marker of PLACEHOLDER_MARKERS) {
      expect(body, `endpoint placeholder marker present: ${marker}`).not.toContain(marker);
    }
  });
});

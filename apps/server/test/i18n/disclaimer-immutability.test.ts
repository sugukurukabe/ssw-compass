/**
 * 免責表示の不変性テスト (T4) — disclaimer immutability lock.
 * Disclaimer immutability tests — the disclaimer is a *boundary*.
 * Tes imutabilitas penafian — penafian adalah sebuah *batas*.
 *
 * 目的 / Purpose / Tujuan:
 * 免責文言は「モデルへの命令文ではなく、平易な記述データ」である。
 * その性質をテストでロックし、将来うっかり文言を変えたら CI で即落ちて
 * 人間レビューを強制する。文言自体はここでは一切変更しない。
 * The disclaimer must stay plain descriptive prose (not an instruction to the
 * model). These tests freeze it so any accidental wording change fails CI and
 * forces human review. The wording itself is never modified here.
 *
 * ── 免責定数の集約状況 / Centralization audit (集約済み = CENTRALIZED) ───────────
 * `DISCLAIMER_BY_LANG` は単一箇所に集約されている:
 *   - 定義: packages/shared-types/src/disclaimers.ts (唯一の定義箇所)
 *   - 公開: packages/shared-types/src/index.ts が再エクスポート
 *   - 利用: 全 9 ツールハンドラ (apps/server/src/tools/<tool>/handler.ts) が
 *           `DISCLAIMER_BY_LANG[lang]` 経由で参照 (ハードコード重複なし)
 * → 分散コピーは存在しない。集約のための文言移動も不要。
 * The constant is defined exactly once (disclaimers.ts), re-exported via the
 * package index, and consumed by all 9 tool handlers via `DISCLAIMER_BY_LANG[lang]`.
 * No duplicated copies exist; no text needed to be relocated.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DISCLAIMER_BY_LANG, SUPPORTED_LANGUAGES } from "@ssw/shared-types";
import { describe, expect, it } from "vitest";
import { classifyProcedureHandler } from "../../src/tools/classify-procedure/handler.js";
import { getDeadlineTimelineHandler } from "../../src/tools/get-deadline-timeline/handler.js";
import { listVisaDocumentsHandler } from "../../src/tools/list-visa-documents/handler.js";

describe("DISCLAIMER_BY_LANG — immutability snapshot (全10言語ロック)", () => {
  // 全言語の文言を1つのインラインスナップショットで凍結する。
  // Freezes every language's wording in a single inline snapshot.
  // 文言を変更すると本テストが落ち、人間レビューを強制する。
  it("locks the exact wording of all 10 languages", () => {
    expect(DISCLAIMER_BY_LANG).toMatchInlineSnapshot(`
      {
        "en": "This is general information only and does not constitute legal advice or gyoseishoshi services under Japanese law (Gyoseishoshi-hō §1-2/§1-3). For individual cases, consult a certified gyoseishoshi or attorney. Authoritative source: https://www.moj.go.jp/isa/",
        "id": "Informasi ini hanya bersifat umum dan bukan nasihat hukum. Untuk kasus individu, silakan berkonsultasi dengan gyoseishoshi/pengacara/ organisasi pendukung terdaftar. Sumber resmi: https://www.moj.go.jp/isa/",
        "ja": "本回答は一般情報の提供であり、法律相談・行政書士業務には該当しません。個別の手続きについては行政書士・弁護士・登録支援機関にご相談ください。最新情報は出入国在留管理庁 (https://www.moj.go.jp/isa/) でご確認ください。",
        "km": "ព័ត៌មាននេះគ្រាន់តែជាព័ត៌មានទូទៅ មិនមែនជាដំបូន្មានផ្នែកច្បាប់ទេ។ សម្រាប់ករណីជាក់លាក់ សូមពិគ្រោះជាមួយ gyoseishoshi ឬមេធាវីដែលមានការអនុញ្ញាត។ ប្រភពផ្លូវការ: https://www.moj.go.jp/isa/",
        "my": "ဤသတင်းအချက်အလက်သည် ယေဘုယျသတင်းအချက်အလက်သာဖြစ်ပြီး တရားဥပဒေဆိုင်ရာ အကြံဉာဏ်မဟုတ်ပါ။ တစ်ဦးချင်းသောကိစ္စရပ်များအတွက် လိုင်စင်ရ gyoseishoshi သို့မဟုတ် ရှေ့နေနှင့် တိုင်ပင်ပါ။ တရားဝင်ရင်းမြစ်: https://www.moj.go.jp/isa/",
        "th": "ข้อมูลนี้เป็นข้อมูลทั่วไปเท่านั้น ไม่ถือเป็นคำแนะนำทางกฎหมาย สำหรับกรณีเฉพาะราย โปรดปรึกษา gyoseishoshi หรือทนายความที่ได้รับการรับรอง แหล่งข้อมูลที่เป็นทางการ: https://www.moj.go.jp/isa/",
        "tl": "Ang impormasyong ito ay pangkalahatan lamang at hindi bumubuo ng legal na payo. Para sa mga indibidwal na kaso, kumonsulta sa sertipikadong gyoseishoshi o abogado. Opisyal na pinagmulan: https://www.moj.go.jp/isa/",
        "vi": "Thông tin này chỉ mang tính tham khảo chung và không phải tư vấn pháp lý. Để giải quyết trường hợp cụ thể, hãy tham khảo gyoseishoshi hoặc luật sư được chứng nhận. Nguồn chính thức: https://www.moj.go.jp/isa/",
        "zh-CN": "此回复仅为一般信息，不构成法律建议或行政书士服务。如需个别咨询，请联系认证的行政书士或律师。权威来源: https://www.moj.go.jp/isa/",
        "zh-TW": "此回覆僅為一般資訊，不構成法律建議或行政書士服務。如需個別諮詢，請聯繫認證的行政書士或律師。權威來源: https://www.moj.go.jp/isa/",
      }
    `);
  });

  // 言語キーの追加・削除も検知する (スナップショット補完)。
  // Also detects added/removed language keys (complements the snapshot).
  it("contains exactly the 10 SUPPORTED_LANGUAGES keys", () => {
    expect(Object.keys(DISCLAIMER_BY_LANG).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});

describe("DISCLAIMER_BY_LANG — plain description, NOT imperative/injection (命令形ガード)", () => {
  // 機械判定は困難なため、明確に「命令的・プロンプトインジェクション的」な
  // 代表語のみを禁止リストにする。免責は読み手 (人間) への平易な案内であり、
  // モデルへの命令やシステムプロンプト操作を含んではならない。
  // A tight allowlist-by-exclusion: the disclaimer is plain guidance for a human
  // reader, so it must never contain phrases that instruct the *model* or look
  // like prompt injection. The list is intentionally small and unambiguous.
  // 注意: "ご相談ください" 等の人間向け丁寧表現は命令ではないため対象外。
  const FORBIDDEN_IMPERATIVE_MARKERS = [
    // English — prompt-injection / model-directed imperatives
    "ignore previous",
    "ignore all previous",
    "disregard previous",
    "system prompt",
    "as an ai",
    "you must",
    "you are an ai",
    "act as",
    "follow these instructions",
    "override the",
    // Japanese — プロンプトインジェクション / モデルへの命令
    "システムプロンプト",
    "以下の指示に従",
    "指示に従って",
    "命令",
    "プロンプトを無視",
    "これまでの指示を無視",
    "あなたは",
  ] as const;

  for (const lang of SUPPORTED_LANGUAGES) {
    it(`[${lang}] contains no imperative/prompt-injection marker`, () => {
      const text = DISCLAIMER_BY_LANG[lang].toLowerCase();
      for (const marker of FORBIDDEN_IMPERATIVE_MARKERS) {
        expect(text).not.toContain(marker.toLowerCase());
      }
    });
  }
});

describe("DISCLAIMER_BY_LANG — present on representative tool output paths (含有保証)", () => {
  // fixture モード (SSW_VERTEX_MODE 未設定) で実行できる 3 ツールの正常系で、
  // 応答テキストと structuredContent.disclaimer に免責が含まれることを検証する。
  // search-visa / validate-zairyu-compatibility / submit-gyoseishoshi-approval /
  // list-law-updates は既存ハンドラテストで免責含有を担保済み (重複回避)。
  // Runtime check for the 3 fixture-mode tools not already covered elsewhere.
  // The other tools' disclaimer presence is asserted in their own handler tests.
  it("classify_procedure includes the disclaimer (success path)", async () => {
    const result = await classifyProcedureHandler({
      currentStatus: "gijinkoku",
      targetStatus: "tokutei_ginou_1",
      location: "japan",
      industry: "agriculture",
      language: "ja",
    });
    const structured = result.structuredContent as { disclaimer?: string };
    expect(structured.disclaimer).toBe(DISCLAIMER_BY_LANG.ja);
    const block = result.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    expect(text).toContain(DISCLAIMER_BY_LANG.ja);
  });

  it("get_deadline_timeline includes the disclaimer (success path)", async () => {
    const result = await getDeadlineTimelineHandler({
      visaCategory: "tokutei_ginou_1",
      eventContext: "status_renewal",
      referenceYearMonth: "2026-09",
      language: "ja",
    });
    const structured = result.structuredContent as { disclaimer?: string };
    expect(structured.disclaimer).toBe(DISCLAIMER_BY_LANG.ja);
    const block = result.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    expect(text).toContain(DISCLAIMER_BY_LANG.ja);
  });

  it("list_visa_documents includes the disclaimer (success path)", async () => {
    const result = await listVisaDocumentsHandler({
      visaCategory: "tokutei_ginou_1",
      industry: "agriculture",
      language: "ja",
    });
    const structured = result.structuredContent as { disclaimer?: string };
    expect(structured.disclaimer).toBe(DISCLAIMER_BY_LANG.ja);
    const block = result.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    expect(text).toContain(DISCLAIMER_BY_LANG.ja);
  });
});

describe("DISCLAIMER_BY_LANG — structural guarantee across all 9 tool handlers", () => {
  // .cursor/rules/tools.mdc: 全ハンドラは DISCLAIMER_BY_LANG を応答に注入する。
  // 各ハンドラのソースが定数を参照していることを静的に確認し、L2 ツール
  // (get_package_status / prepare_document_package 等) を含む 9 ツール全てで
  // 免責注入が外れていないことを保証する。
  // Static guarantee that every handler still references the disclaimer constant,
  // covering all 9 tools including the L2 ones that are costly to exercise at runtime.
  const HERE = dirname(fileURLToPath(import.meta.url));
  const TOOLS_DIR = join(HERE, "..", "..", "src", "tools");
  const TOOL_HANDLERS = [
    "classify-procedure",
    "get-deadline-timeline",
    "get-package-status",
    "list-law-updates",
    "list-visa-documents",
    "prepare-document-package",
    "search-visa",
    "submit-gyoseishoshi-approval",
    "validate-zairyu-compatibility",
  ] as const;

  it("covers exactly 9 tools", () => {
    expect(TOOL_HANDLERS).toHaveLength(9);
  });

  for (const tool of TOOL_HANDLERS) {
    it(`${tool}/handler.ts references DISCLAIMER_BY_LANG`, () => {
      const source = readFileSync(join(TOOLS_DIR, tool, "handler.ts"), "utf8");
      expect(source).toContain("DISCLAIMER_BY_LANG");
    });
  }
});

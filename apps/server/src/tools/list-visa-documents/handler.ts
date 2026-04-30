import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  type DocumentEntry,
  effectiveLegalLevel,
  HTML_PREVIEW_WATERMARK,
  ListVisaDocumentsInputV4,
  type SupportedLanguage,
} from "@ssw/shared-types";
import type { Request } from "express";
import { assertHitlGateRuntime } from "../../hitl/lockgate.js";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { lookupDocuments } from "./document-catalog.js";
import { ListVisaDocumentsOutput } from "./schema.js";

export const listVisaDocumentsHandler = instrumentTool(
  "list_visa_documents",
  async (rawArgs: unknown, _extra?: { req?: Request }): Promise<CallToolResult> => {
    // v4 schema: output_format + include_omission_conditions + 10言語 (extends v3)
    const args = ListVisaDocumentsInputV4.parse(rawArgs);

    // ADR-020 + ADR-014 §Per-call escalation:
    // pdf_draft / csv escalates from L1 → L2 (Pro + gyoseishoshi required)
    const runtimeLevel = effectiveLegalLevel(args);
    const authContext = (
      _extra?.req as { authContext?: import("@ssw/shared-types").AuthContextType } | undefined
    )?.authContext;
    assertHitlGateRuntime(authContext ?? null, "list_visa_documents", "L1", runtimeLevel);

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "list_visa_documents", reason: "pii_blocked", findings: piiCheck.types },
        "pii_blocked",
      );
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "個人情報 (在留番号・パスポート番号・マイナンバー等) は入力できません。" +
              "一般的な質問のみ受け付けます。",
          },
        ],
      };
    }

    const t0 = performance.now();
    // lookupDocuments expects v3 args; pass compatible subset
    const documents = [...lookupDocuments({ ...args, language: "ja" as const })];
    if (args.include_omission_conditions) {
      const omissionDocs: DocumentEntry[] = [
        {
          id: "table2_omission_same_fiscal_year_repeat",
          label: {
            ja: "第2表の1〜3 (同一年度内2人目以降の場合は不要)",
            en: "Table 2-1 to 2-3 (omitted for same-fiscal-year repeat applications)",
            id: "Tabel 2-1 hingga 2-3 (dapat dihilangkan untuk permohonan lanjutan pada tahun fiskal yang sama)",
          },
          description:
            "同一年度内に特定技能外国人を既に受け入れている所属機関は、第2表の1〜3の書類が不要となる場合があります。",
          category: "conditional",
          status: "omitted_due_to_category",
          group: "omission",
          ministry: "法務省",
          trustLevel: "primary_source",
          sourceUrl: "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html",
        },
        {
          id: "reference_form_1_29_omission_pledge",
          label: {
            ja: "書類省略に当たっての誓約書 (参考様式第1-29号)",
            en: "Pledge for document omission (Reference Form 1-29)",
            id: "Surat pernyataan penghilangan dokumen (Formulir Referensi 1-29)",
          },
          description:
            "第2表の1又は同一年度内2人目以降の省略条件を利用する場合に確認すべき参考様式です。",
          category: "conditional",
          status: "omitted_due_to_category",
          group: "omission",
          ministry: "法務省",
          trustLevel: "primary_source",
          sourceUrl: "https://www.moj.go.jp/isa/content/001378963.docx",
        },
      ];
      documents.push(...omissionDocs);
    }

    if (documents.length === 0) {
      logger.info(
        { tool: "list_visa_documents", visa_category: args.visaCategory, result: "empty" },
        "list_visa_documents_empty",
      );
      return {
        content: [
          {
            type: "text",
            text:
              "該当の在留資格についての書類一覧は本ツールでは提供していません。" +
              "出入国在留管理庁公式サイト (https://www.moj.go.jp/isa/) をご確認ください。",
          },
        ],
      };
    }

    const lang = args.language as SupportedLanguage;
    const payload = ListVisaDocumentsOutput.parse({
      documents,
      disclaimer: DISCLAIMER_BY_LANG[lang],
      asOf: new Date().toISOString().slice(0, 10),
    });

    logger.info(
      {
        tool: "list_visa_documents",
        duration_ms: performance.now() - t0,
        visa_category: args.visaCategory,
        industry: args.industry,
        document_count: payload.documents.length,
        output_format: args.output_format,
        status: "ok",
      },
      "list_visa_documents_ok",
    );

    // label は ja/en/id のみ対応 → UILanguage fallback
    const labelLang = (["ja", "en", "id"] as const).includes(args.language as "ja" | "en" | "id")
      ? (args.language as "ja" | "en" | "id")
      : "en";
    const summary = payload.documents.map((d) => `・${d.label[labelLang]}`).join("\n");

    // output_format に応じた付加情報
    const extraContent: Record<string, unknown> = {};
    if (args.output_format === "html_preview") {
      // Free tier: watermarked HTML preview
      extraContent["html_preview"] =
        `<ul>${documents.map((d) => `<li>${d.label[labelLang]}</li>`).join("")}</ul>`;
      extraContent["watermark"] = HTML_PREVIEW_WATERMARK;
    } else if (args.output_format === "pdf_draft") {
      // Sprint 4: pdf_draft は pro+ 確認済み、実 PDF 生成は Sprint 5
      extraContent["pdf_draft_available"] = true;
      extraContent["pdf_draft_note"] =
        "PDF 生成は Sprint 5 で実装予定です。現在は書類リストのみ返します。";
      extraContent["html_preview"] =
        `<ul>${documents.map((d) => `<li>${d.label[labelLang]}</li>`).join("")}</ul>`;
    } else if (args.output_format === "csv") {
      // Sprint 4: csv は pro+ 確認済み、実 CSV 生成は Sprint 5
      extraContent["csv_available"] = true;
      extraContent["csv_note"] =
        "CSV 生成は Sprint 5 で実装予定です。現在は書類リストのみ返します。";
    }

    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n${payload.disclaimer}`,
        },
      ],
      structuredContent: { ...payload, ...extraContent },
    };
  },
);

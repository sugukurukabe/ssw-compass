import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG } from "@ssw/shared-types";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { lookupDocuments } from "./document-catalog.js";
import { ListVisaDocumentsInput, ListVisaDocumentsOutput } from "./schema.js";

export const listVisaDocumentsHandler = instrumentTool(
  "list_visa_documents",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = ListVisaDocumentsInput.parse(rawArgs);

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
    const documents = [...lookupDocuments(args)];

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

    const payload = ListVisaDocumentsOutput.parse({
      documents,
      disclaimer: DISCLAIMER_BY_LANG[args.language],
      asOf: new Date().toISOString().slice(0, 10),
    });

    logger.info(
      {
        tool: "list_visa_documents",
        duration_ms: performance.now() - t0,
        visa_category: args.visaCategory,
        industry: args.industry,
        document_count: payload.documents.length,
        status: "ok",
      },
      "list_visa_documents_ok",
    );

    const summary = payload.documents.map((d) => `・${d.label[args.language]}`).join("\n");

    return {
      content: [
        {
          type: "text",
          text: `${summary}\n\n${payload.disclaimer}`,
        },
      ],
      structuredContent: payload,
    };
  },
);

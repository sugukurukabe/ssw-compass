import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG } from "@vcj/shared-types";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { sanitizeRetrievedSnippet } from "../../safety/output-sanitizer.js";
import { vertexSearch } from "../../vertex.js";
import { buildQuery, SearchVisaInput, SearchVisaOutput } from "./schema.js";

export const searchVisa = instrumentTool(
  "search_visa",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = SearchVisaInput.parse(rawArgs);

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "search_visa", reason: "pii_blocked", findings: piiCheck.types },
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
    const grounded = await vertexSearch({
      query: buildQuery(args),
      datastore: "visa_legal",
      confidenceThreshold: 0.7,
      sourceAllowlist: ["*.go.jp"],
    });

    if (grounded.chunks.length === 0) {
      logger.info(
        { tool: "search_visa", duration_ms: performance.now() - t0, result_count: 0 },
        "search_visa_empty",
      );
      return {
        content: [
          {
            type: "text",
            text:
              "公式情報源で該当する内容が見つかりませんでした。" +
              "出入国在留管理庁公式サイト (https://www.moj.go.jp/isa/) をご確認ください。",
          },
        ],
      };
    }

    const sanitizedChunks = grounded.chunks.map((c) => {
      const result = sanitizeRetrievedSnippet(c.snippet);
      if (result.flagged) {
        logger.warn(
          {
            tool: "search_visa",
            event: "retrieved_content_sanitized",
            doc_id: c.docId,
            reasons: result.reasons,
          },
          "retrieved_content_sanitized",
        );
      }
      return { ...c, snippet: result.safe };
    });

    const payload = SearchVisaOutput.parse({
      results: sanitizedChunks.map((c) => ({
        title: c.title,
        snippet: c.snippet,
        sourceUrl: c.uri,
        sourceType: "primary_source",
        sourceDate: c.publishedAt,
        confidence: c.confidence,
      })),
      disclaimer: DISCLAIMER_BY_LANG[args.language],
      asOf: new Date().toISOString().slice(0, 10),
    });

    logger.info(
      {
        tool: "search_visa",
        duration_ms: performance.now() - t0,
        result_count: payload.results.length,
        status: "ok",
      },
      "search_visa_ok",
    );

    return {
      content: [
        {
          type: "text",
          text:
            `${payload.results.length}件の公式情報源を検出 (${payload.asOf}時点)\n` +
            payload.disclaimer,
        },
      ],
      structuredContent: payload,
    };
  },
);

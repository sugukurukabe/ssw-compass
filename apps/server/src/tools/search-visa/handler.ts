import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG, isVertexGrounded, SearchVisaInputV4 } from "@ssw/shared-types";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { sanitizeRetrievedSnippet } from "../../safety/output-sanitizer.js";
import { vertexSearch } from "../../vertex.js";
import { buildQuery, SearchVisaOutput } from "./schema.js";

export const searchVisa = instrumentTool(
  "search_visa",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    // v4 schema (10言語 + response_style + enable_followup_suggestions)
    // extends v3 — backward compatible
    const args = SearchVisaInputV4.parse(rawArgs);

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

    // ADR-018: Vertex grounding is fully supported for ja/en/id only in Sprint 4.
    // For the other 7 languages we still query (best-effort) but log a note.
    if (!isVertexGrounded(args.language)) {
      logger.info(
        { tool: "search_visa", language: args.language, event: "non_grounded_language" },
        "non_grounded_language_query",
      );
    }

    const t0 = performance.now();
    const grounded = await vertexSearch({
      // buildQuery uses category/industry/yearMonth only — language field is irrelevant
      query: buildQuery({ ...args, language: "ja" as const }),
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

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG } from "@vcj/shared-types";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { sanitizeRetrievedSnippet } from "../../safety/output-sanitizer.js";
import { vertexSearch } from "../../vertex.js";
import {
  classifyProcedure,
  PROCEDURE_LABEL,
  PROCEDURE_NEXT_STEPS,
  PROCEDURE_RATIONALE,
} from "./decision-tree.js";
import { buildClassifyQuery, ClassifyProcedureInput, ClassifyProcedureOutput } from "./schema.js";

export const classifyProcedureHandler = instrumentTool(
  "classify_procedure",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = ClassifyProcedureInput.parse(rawArgs);

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "classify_procedure", reason: "pii_blocked", findings: piiCheck.types },
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
    const decision = classifyProcedure(args);

    const grounded = await vertexSearch({
      query: buildClassifyQuery(args, decision),
      datastore: "visa_legal",
      confidenceThreshold: 0.7,
      sourceAllowlist: ["*.go.jp"],
    });

    const sanitizedReferences = grounded.chunks.map((c) => {
      const result = sanitizeRetrievedSnippet(c.snippet);
      if (result.flagged) {
        logger.warn(
          {
            tool: "classify_procedure",
            event: "retrieved_content_sanitized",
            doc_id: c.docId,
            reasons: result.reasons,
          },
          "retrieved_content_sanitized",
        );
      }
      return {
        title: c.title,
        sourceUrl: c.uri,
        sourceType: "primary_source" as const,
        sourceDate: c.publishedAt,
        confidence: c.confidence,
      };
    });

    const payload = ClassifyProcedureOutput.parse({
      procedureType: decision.type,
      procedureLabel: PROCEDURE_LABEL[decision.type],
      rationale: PROCEDURE_RATIONALE[decision.type][args.language],
      nextSteps: [...PROCEDURE_NEXT_STEPS[decision.type][args.language]],
      references: sanitizedReferences,
      disclaimer: DISCLAIMER_BY_LANG[args.language],
      asOf: new Date().toISOString().slice(0, 10),
    });

    logger.info(
      {
        tool: "classify_procedure",
        duration_ms: performance.now() - t0,
        rule_id: decision.ruleId,
        procedure_type: decision.type,
        status: "ok",
      },
      "classify_procedure_ok",
    );

    const procedureLabelForLang = payload.procedureLabel[args.language];

    return {
      content: [
        {
          type: "text",
          text:
            `${procedureLabelForLang} (${payload.asOf}時点)\n` +
            payload.rationale +
            "\n\n" +
            payload.disclaimer,
        },
      ],
      structuredContent: payload,
    };
  },
);

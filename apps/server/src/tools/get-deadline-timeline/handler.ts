import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  FREE_TIER_CASES_LIMIT,
  GetDeadlineTimelineInputV4,
  PRO_TIER_CASES_LIMIT,
  TierLimitError,
} from "@ssw/shared-types";
import type { Request } from "express";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { sanitizeRetrievedSnippet } from "../../safety/output-sanitizer.js";
import { vertexSearch } from "../../vertex.js";
import { computeTimeline } from "./deadline-calc.js";
import { buildTimelineQuery, GetDeadlineTimelineOutput } from "./schema.js";

export const getDeadlineTimelineHandler = instrumentTool(
  "get_deadline_timeline",
  async (rawArgs: unknown, _extra?: { req?: Request }): Promise<CallToolResult> => {
    // v4 schema (10言語 + cases + alert_thresholds_days + visualization)
    const args = GetDeadlineTimelineInputV4.parse(rawArgs);

    // ADR-014 §Per-call escalation: legalLevel stays L1 (no escalation needed here)
    // Free tier: cases.length <= FREE_TIER_CASES_LIMIT (3)
    // Pro tier:  cases.length <= PRO_TIER_CASES_LIMIT (30)
    // Business:  unlimited
    if (args.cases !== undefined && args.cases.length > 0) {
      // auth from request context — anonymous = free tier
      const authContext = (_extra?.req as { authContext?: { tier?: string } } | undefined)
        ?.authContext;
      const tier = authContext?.tier ?? "free";

      if (tier === "free" && args.cases.length > FREE_TIER_CASES_LIMIT) {
        throw new TierLimitError(
          "free",
          "cases",
          `Free プランでは在留期限ダッシュボードは${FREE_TIER_CASES_LIMIT}名までです。Pro なら${PRO_TIER_CASES_LIMIT}名まで管理できます。`,
        );
      }
      if (tier === "pro" && args.cases.length > PRO_TIER_CASES_LIMIT) {
        throw new TierLimitError(
          "pro",
          "cases",
          `Pro プランでは在留期限ダッシュボードは${PRO_TIER_CASES_LIMIT}名までです。Business なら無制限です。`,
        );
      }
    }

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "get_deadline_timeline", reason: "pii_blocked", findings: piiCheck.types },
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
    // computeTimeline / buildTimelineQuery use visaCategory/eventContext/referenceYearMonth
    // only — pass v3-compatible subset (language override to "ja" is a no-op for query building)
    const v3Args = { ...args, language: "ja" as const };
    const deadlines = computeTimeline(v3Args);

    const grounded = await vertexSearch({
      query: buildTimelineQuery(v3Args),
      datastore: "visa_legal",
      confidenceThreshold: 0.7,
      sourceAllowlist: ["*.go.jp"],
    });

    const sanitizedReferences = grounded.chunks.map((c) => {
      const result = sanitizeRetrievedSnippet(c.snippet);
      if (result.flagged) {
        logger.warn(
          {
            tool: "get_deadline_timeline",
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

    const payload = GetDeadlineTimelineOutput.parse({
      deadlines,
      references: sanitizedReferences,
      disclaimer: DISCLAIMER_BY_LANG[args.language],
      asOf: new Date().toISOString().slice(0, 10),
    });

    logger.info(
      {
        tool: "get_deadline_timeline",
        duration_ms: performance.now() - t0,
        visa_category: args.visaCategory,
        event_context: args.eventContext,
        deadline_count: payload.deadlines.length,
        status: "ok",
      },
      "get_deadline_timeline_ok",
    );

    // DeadlineEntry.label has ja/en/id keys only; fall back to "en" for new languages
    const labelLang = (["ja", "en", "id"] as const).includes(args.language as "ja" | "en" | "id")
      ? (args.language as "ja" | "en" | "id")
      : "en";

    const summaryLines = payload.deadlines
      .map((d) => `・${d.label[labelLang]} — ${d.relativeLabel[labelLang]}`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `${summaryLines}\n\n${payload.disclaimer}`,
        },
      ],
      structuredContent: payload,
    };
  },
);

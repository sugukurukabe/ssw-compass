/**
 * list_law_updates handler (v4 §3.2 / Batch 7 SSOT / Batch 9 handler)
 * 制度変動カレンダーから active entries をフィルタして返す。
 * Batch 7 で確立した filterActiveLawUpdates + KNOWN_LAW_UPDATES_FIXTURE を使用。
 *
 * legalLevel: L0 (Free, anonymous OK)
 * PII: なし (制度情報のみ)
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  KNOWN_LAW_UPDATES_FIXTURE,
  ListLawUpdatesInput,
  type SupportedLanguage,
} from "@ssw/shared-types";
import { filterActiveLawUpdates } from "../../law-updates/active-filter.js";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";

export const listLawUpdatesHandler = instrumentTool(
  "list_law_updates",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = ListLawUpdatesInput.parse(rawArgs);

    const t0 = performance.now();

    // active entries のみ取得
    let entries = filterActiveLawUpdates(KNOWN_LAW_UPDATES_FIXTURE);

    // category フィルタ
    if (args.category !== "all") {
      entries = entries.filter((e) => e.category === args.category);
    }

    // affecting_role フィルタ
    if (args.affecting_role !== "all") {
      entries = entries.filter((e) =>
        e.affecting_roles.includes(
          args.affecting_role as Exclude<typeof args.affecting_role, "all">,
        ),
      );
    }

    // since フィルタ
    if (args.since !== undefined) {
      const sinceMs = new Date(args.since).getTime();
      entries = entries.filter((e) => {
        if (e.effective_date === "TBD") return false;
        return new Date(e.effective_date).getTime() >= sinceMs;
      });
    }

    // limit
    entries = entries.slice(0, args.limit);

    logger.info(
      {
        tool: "list_law_updates",
        duration_ms: performance.now() - t0,
        count: entries.length,
        category: args.category,
        lang: args.language,
      },
      "list_law_updates_ok",
    );

    const lang = args.language as SupportedLanguage;
    const disclaimer = DISCLAIMER_BY_LANG[lang];
    const asOf = new Date().toISOString();

    return {
      content: [
        {
          type: "text",
          text:
            `${entries.length}件の制度変動情報 (${args.language})\n` +
            entries
              .map(
                (e) => `・${e.title_ja} (${e.effective_date}) — ${e.impact_severity.toUpperCase()}`,
              )
              .join("\n") +
            `\n\n${disclaimer}`,
        },
      ],
      structuredContent: {
        updates: entries,
        asOf,
        disclaimer,
      },
    };
  },
);

/**
 * list_law_updates ツールの入出力スキーマ (v4 §3.2 / sprint-4-plan §3.5)
 * list_law_updates tool input/output schema
 * Skema input/output alat list_law_updates
 *
 * Interface Freeze (sprint-4-plan §3.5): Sprint 4 全期間で不変。
 *
 * SSOT: LawUpdateCategory / AffectingRole / LawUpdate は
 * packages/shared-types/src/law-updates.ts から import する。
 */

import { z } from "zod";
import { AffectingRole, LawUpdate, LawUpdateCategory } from "../law-updates.js";

// SUPPORTED_LANGUAGES は Batch 8 で packages/shared-types/src/i18n/supported-languages.ts に移動する予定。
// Sprint 4 Batch 7 では ja/en/id のみ先行定義して DISCLAIMER_BY_LANG の既存キーと揃える。
const SUPPORTED_LANGUAGES_B7 = ["ja", "en", "id"] as const;

export const ListLawUpdatesInput = z
  .object({
    language: z.enum(SUPPORTED_LANGUAGES_B7).default("ja"),
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("指定日以降の entry のみ返す"),
    category: LawUpdateCategory.default("all"),
    affecting_role: AffectingRole.default("all"),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export type ListLawUpdatesInput = z.infer<typeof ListLawUpdatesInput>;

export const ListLawUpdatesOutput = z
  .object({
    updates: z.array(LawUpdate),
    asOf: z.string().datetime(),
    disclaimer: z.string(),
  })
  .strict();
export type ListLawUpdatesOutput = z.infer<typeof ListLawUpdatesOutput>;

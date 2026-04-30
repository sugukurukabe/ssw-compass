import { z } from "zod";

export const SearchVisaInput = z
  .object({
    category: z
      .enum([
        "tokutei_ginou_1",
        "tokutei_ginou_2",
        "ginou_jisshu",
        "gijinkoku",
        "kazokutaizai",
        "other",
      ])
      .describe("在留資格カテゴリ"),
    industry: z
      .enum([
        "agriculture",
        "fishery",
        "food_manufacturing",
        "food_service",
        "manufacturing",
        "industrial_products_manufacturing",
        "construction",
        "nursing_care",
        "building_cleaning",
        "automobile_repair",
        "automobile_maintenance",
        "aviation",
        "lodging",
        "accommodation",
        "shipbuilding",
        "electronics",
        "automobile_transportation",
        "railway",
        "forestry",
        "wood_products",
        "other",
      ])
      .optional()
      .describe("特定技能の対象産業分野"),
    yearMonth: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .describe("入国・申請予定の年月 (YYYY-MM 形式)"),
    language: z
      .enum(["ja", "en", "id"])
      .default("ja")
      .describe("出力言語: 日本語/英語/インドネシア語"),
  })
  .strict();
export type SearchVisaInput = z.infer<typeof SearchVisaInput>;

export const SearchVisaOutput = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      snippet: z.string(),
      sourceUrl: z.string().url(),
      sourceType: z.literal("primary_source"),
      sourceDate: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  disclaimer: z.string(),
  asOf: z.string(),
});
export type SearchVisaOutput = z.infer<typeof SearchVisaOutput>;

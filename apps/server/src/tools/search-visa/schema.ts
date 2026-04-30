import type { SearchVisaInput } from "@ssw/shared-types";

export { SearchVisaInput, SearchVisaOutput } from "@ssw/shared-types";

const CATEGORY_QUERY_JA: Partial<Record<SearchVisaInput["category"], string>> = {
  tokutei_ginou_1: "特定技能1号",
  tokutei_ginou_2: "特定技能2号",
  ginou_jisshu: "技能実習",
  gijinkoku: "技術・人文知識・国際業務",
  kazokutaizai: "家族滞在",
};

const INDUSTRY_QUERY_JA: Partial<Record<NonNullable<SearchVisaInput["industry"]>, string>> = {
  agriculture: "農業 農林水産省",
  fishery: "漁業 水産庁 農林水産省",
  food_service: "外食業 農林水産省",
  manufacturing: "工業製品製造業 経済産業省",
  construction: "建設 国土交通省",
  nursing_care: "介護 厚生労働省",
  building_cleaning: "ビルクリーニング 厚生労働省",
  automobile_repair: "自動車整備 国土交通省",
  aviation: "航空 国土交通省",
  lodging: "宿泊 国土交通省 観光庁",
  shipbuilding: "造船 舶用工業 国土交通省",
  electronics: "工業製品製造業 電気電子 経済産業省",
};

export function buildQuery(args: SearchVisaInput): string {
  const parts: string[] = [CATEGORY_QUERY_JA[args.category] ?? args.category];
  if (args.industry !== undefined) {
    parts.push(INDUSTRY_QUERY_JA[args.industry] ?? args.industry);
  }
  if (args.yearMonth !== undefined) {
    parts.push(args.yearMonth);
  }
  return parts.join(" ");
}

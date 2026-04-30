export type IndustryRoute = {
  sourceAllowlist: readonly string[];
  preferredMinistries: readonly string[];
  preferredTags: readonly string[];
  dataStoreGroup: string;
};

const MOJ_HOST = "www.moj.go.jp";

const ROUTES: Record<string, IndustryRoute> = {
  agriculture: route(["www.maff.go.jp", MOJ_HOST], ["maff", "moj"], ["agriculture", "ssw_1"]),
  fishery: route(
    ["www.jfa.maff.go.jp", "www.maff.go.jp", MOJ_HOST],
    ["maff", "moj"],
    ["fishery", "ssw_1"],
  ),
  food_service: route(["www.maff.go.jp", MOJ_HOST], ["maff", "moj"], ["food_service", "ssw_1"]),
  construction: route(["www.mlit.go.jp", MOJ_HOST], ["mlit", "moj"], ["construction", "ssw_1"]),
  nursing_care: route(["www.mhlw.go.jp", MOJ_HOST], ["mhlw", "moj"], ["nursing_care", "ssw_1"]),
  building_cleaning: route(
    ["www.mhlw.go.jp", MOJ_HOST],
    ["mhlw", "moj"],
    ["building_cleaning", "ssw_1"],
  ),
  automobile_repair: route(
    ["www.mlit.go.jp", MOJ_HOST],
    ["mlit", "moj"],
    ["automobile_repair", "ssw_1"],
  ),
  aviation: route(["www.mlit.go.jp", MOJ_HOST], ["mlit", "moj"], ["aviation", "ssw_1"]),
  lodging: route(["www.mlit.go.jp", MOJ_HOST], ["mlit", "moj"], ["lodging", "ssw_1"]),
  shipbuilding: route(["www.mlit.go.jp", MOJ_HOST], ["mlit", "moj"], ["shipbuilding", "ssw_1"]),
};

function route(
  sourceAllowlist: readonly string[],
  preferredMinistries: readonly string[],
  preferredTags: readonly string[],
): IndustryRoute {
  return { sourceAllowlist, preferredMinistries, preferredTags, dataStoreGroup: "visa_legal_core" };
}

export function sourceAllowlistForIndustry(industry: string | undefined): readonly string[] {
  if (industry === undefined) return ["*.go.jp"];
  return ROUTES[industry]?.sourceAllowlist ?? ["*.go.jp"];
}

export function routeForIndustry(industry: string | undefined): IndustryRoute {
  if (industry === undefined) {
    return route(["*.go.jp"], ["moj"], ["ssw_1", "procedure"]);
  }
  return ROUTES[industry] ?? route(["*.go.jp"], ["moj"], ["ssw_1", "procedure"]);
}

/**
 * 特定技能の対象分野定数
 * SSW industry constants for specified skilled worker (特定技能) program
 * Konstanta industri untuk program pekerja berketerampilan khusus (特定技能)
 *
 * Source: 出入国在留管理庁 moj.go.jp/isa/applications/ssw/
 * Confirmed: 2026-04-28 (Batch 1 pre-flight)
 * Count: 16 分野 (12 original + 4 added by Cabinet Decision 2024-03-29)
 *
 * Naming: Does NOT embed the count in the constant name (SSW_INDUSTRIES_ACTIVE,
 * not SSW_16_INDUSTRIES). Count-free name is resilient to future field additions.
 * See ADR-017 for expansion policy.
 *
 * 命名規則: 分野数を定数名に含めない (SSW_INDUSTRIES_ACTIVE / SSW_16_INDUSTRIES 不可)
 * 将来の分野追加時に rename 不要。ADR-017 を参照。
 */

export const SSW_INDUSTRIES_ACTIVE = [
  // ── 2019年度 創設時の 12 分野 ──────────────────────────────────────────
  "nursing_care", // 介護
  "building_cleaning", // ビルクリーニング
  "industrial_products_manufacturing", // 工業製品製造業 (旧:素形材・産業機械・電気電子情報関連の3分野を2022年統合)
  "construction", // 建設
  "shipbuilding", // 造船・舶用工業
  "automobile_maintenance", // 自動車整備
  "aviation", // 航空
  "accommodation", // 宿泊
  "agriculture", // 農業
  "fishery", // 漁業
  "food_manufacturing", // 飲食料品製造業
  "food_service", // 外食業
  // ── 2024年3月29日 閣議決定 追加 4 分野 ─────────────────────────────────
  "automobile_transportation", // 自動車運送業 (トラック・バス・タクシー)
  "railway", // 鉄道
  "forestry", // 林業
  "wood_products", // 木材産業
] as const;

export type SswIndustry = (typeof SSW_INDUSTRIES_ACTIVE)[number];

/**
 * 労働者派遣形態が認められる分野 (2分野のみ)
 * Industries where staff dispatch (労働者派遣) is permitted
 * Industri yang mengizinkan penyaluran tenaga kerja (haken)
 *
 * Basis: 特定技能制度 派遣形態容認は農業・漁業の2分野のみ (v4 §0 判断 E / v4 §5.1)
 * All other 14 industries: 直接雇用のみ (direct employment only)
 * Expansion requires new ADR superseding ADR-017.
 */
export const DISPATCH_ALLOWED_INDUSTRIES = [
  "agriculture",
  "fishery",
] as const satisfies readonly SswIndustry[];

export type DispatchAllowedIndustry = (typeof DISPATCH_ALLOWED_INDUSTRIES)[number];

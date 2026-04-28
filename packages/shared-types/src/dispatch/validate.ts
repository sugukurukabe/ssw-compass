/**
 * 派遣業 industry バリデーション (ADR-017 / v4 §5.2)
 * Dispatch industry validation
 * Validasi industri penyaluran tenaga kerja
 *
 * 労働者派遣形態が認められるのは農業・漁業の 2 分野のみ (ADR-017)。
 * Only agriculture and fishery permit the dispatch employment arrangement (ADR-017).
 * Hanya pertanian dan perikanan yang mengizinkan penyaluran tenaga kerja (ADR-017).
 *
 * 拡張には ADR-017 を supersede する新 ADR が必要。
 * Expansion requires a new ADR superseding ADR-017.
 * Perluasan memerlukan ADR baru yang menggantikan ADR-017.
 */

import type { DispatchAllowedIndustry, SswIndustry } from "../ssw-industries.js";
import { DISPATCH_ALLOWED_INDUSTRIES } from "../ssw-industries.js";

export class DispatchNotAllowedError extends Error {
  constructor(public readonly industry: string) {
    super(
      `労働者派遣形態が認められるのは農業・漁業の2分野のみです (${industry} は不可)。` +
        "詳細: https://www.moj.go.jp/isa/applications/ssw/10_00020.html",
    );
    this.name = "DispatchNotAllowedError";
  }
}

/**
 * 派遣形態が認められる分野かどうかを検証する
 * Validate that the given industry permits dispatch employment
 * Validasi bahwa industri yang diberikan mengizinkan penyaluran tenaga kerja
 *
 * @throws DispatchNotAllowedError — 派遣が認められない分野の場合
 */
export function assertDispatchAllowed(
  industry: SswIndustry,
): asserts industry is DispatchAllowedIndustry {
  if (!(DISPATCH_ALLOWED_INDUSTRIES as readonly string[]).includes(industry)) {
    throw new DispatchNotAllowedError(industry);
  }
}

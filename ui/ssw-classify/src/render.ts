import type {
  ApplicantProfile,
  ClassifyProcedureOutput,
  FormBundle,
  ReceivingOrganizationProfile,
  UILanguage,
} from "@ssw/shared-types";
import {
  escapeAttr,
  renderLanguageToggle,
  safePrimaryHref,
  setInnerHTML,
  wireLanguageToggle,
} from "@ssw/ui-bridge";
import DOMPurify from "dompurify";

/**
 * Two-tier disclaimer (see ADR-002-rejected-notes / search-visa render.ts):
 * L1 brand-voice short notice at the top, L2 full server disclaimer
 * (DISCLAIMER_BY_LANG, v2 §5.1 verbatim) below the result — UI must NOT
 * truncate, reflow, or re-format L2.
 */
const L1_NOTICE_BY_LANG = {
  ja: "\u{1F4CD} 一般情報の羅針盤 — 個別案件は行政書士へ",
  en: "\u{1F4CD} Compass for general info — individual cases: gyoseishoshi",
  id: "\u{1F4CD} Kompas informasi umum — kasus individu: gyoseishoshi",
} as const;

const I18N = {
  ja: {
    title: "申請ルート判定",
    procedure: "1. どの申請か",
    organization: "2. 所属機関の状況",
    applicant: "3. 申請人の状況",
    industry: "4. 分野",
    result: "必要になる表",
    followUp: "この内容で必要書類チェックリストへ進む",
    sources: "出典を確認",
    internCheck: "技能実習の職種・作業と特定技能分野の対応を公式資料で確認してください。",
    internSameField: "同一分野として扱える場合のみ技能試験・日本語試験の両方が免除候補になります。",
    internDifferentField: "異なる分野の場合、日本語試験のみ免除候補で、分野別技能試験は必要です。",
    asOf: "情報基準日",
    confidence: "判定の信頼度",
    assumptions: "前提条件",
  },
  en: {
    title: "Procedure route",
    procedure: "1. Procedure",
    organization: "2. Organization profile",
    applicant: "3. Applicant profile",
    industry: "4. Industry",
    result: "Required tables",
    followUp: "Continue to document checklist",
    sources: "Show sources",
    internCheck:
      "Confirm the official mapping between the technical-intern occupation/work type and the SSW industry.",
    internSameField:
      "Both skills and Japanese tests may be exempt only when the field is officially treated as the same.",
    internDifferentField:
      "For a different field, only the Japanese test may be exempt; the sector skills test is still required.",
    asOf: "As of",
    confidence: "Classification confidence",
    assumptions: "Assumptions",
  },
  id: {
    title: "Rute prosedur",
    procedure: "1. Prosedur",
    organization: "2. Profil organisasi",
    applicant: "3. Profil pemohon",
    industry: "4. Bidang",
    result: "Tabel yang diperlukan",
    followUp: "Lanjut ke daftar dokumen",
    sources: "Tampilkan sumber",
    internCheck: "Pastikan pemetaan resmi antara jenis pekerjaan pemagangan teknis dan bidang SSW.",
    internSameField:
      "Ujian keterampilan dan bahasa Jepang hanya dapat dikecualikan jika bidangnya resmi dianggap sama.",
    internDifferentField:
      "Jika bidang berbeda, hanya ujian bahasa Jepang yang mungkin dikecualikan; ujian keterampilan bidang tetap diperlukan.",
    asOf: "Per tanggal",
    confidence: "Keyakinan klasifikasi",
    assumptions: "Asumsi",
  },
} as const;

const ALLOWED_HREF = /^https:\/\/(www\.)?(moj|mhlw|soumu|cao|maff|mlit)\.go\.jp\//;

type Procedure = FormBundle["procedure"];

export interface ClassifierState {
  procedure: Procedure;
  receivingOrganizationProfile: ReceivingOrganizationProfile;
  applicantProfile: ApplicantProfile;
  industry: FormBundle["industry"];
  showSources: boolean;
}

export interface RenderCallbacks {
  onProcedureChange: (value: Procedure) => void;
  onOrganizationChange: (value: ReceivingOrganizationProfile) => void;
  onApplicantChange: (value: ApplicantProfile) => void;
  onIndustryChange: (value: FormBundle["industry"]) => void;
  onToggleSources: () => void;
  onCommit: () => void;
  onLangChange: (lang: UILanguage) => void;
}

const ORG_LABEL: Record<ReceivingOrganizationProfile, string> = {
  same_fiscal_year_repeat: "同年度2人目以降",
  table2_1_eligible: "第2表の1 該当",
  listed_company: "上場企業",
  mutual_company: "相互会社",
  innovation_company: "イノベーション創出企業等",
  withholding_tax_10m: "源泉徴収税額1000万円以上",
  continuous_acceptance_3y: "3年継続受入実績",
  corporation: "法人",
  sole_proprietor: "個人事業主",
  not_applicable: "第2表不要",
};

const APPLICANT_LABEL: Record<ApplicantProfile, string> = {
  technical_intern_2_same_field: "技能実習2号・同分野",
  technical_intern_2_different_field: "技能実習2号・異分野",
  no_exemption: "試験免除なし",
  sector_exception: "分野固有例外",
};

const INDUSTRY_LABEL: Record<FormBundle["industry"], string> = {
  agriculture: "農業",
  fishery: "漁業",
  food_manufacturing: "飲食料品製造",
  food_service: "外食",
  manufacturing: "工業製品製造",
  industrial_products_manufacturing: "工業製品製造",
  construction: "建設",
  nursing_care: "介護",
  building_cleaning: "ビルクリーニング",
  automobile_repair: "自動車整備",
  automobile_maintenance: "自動車整備",
  aviation: "航空",
  lodging: "宿泊",
  accommodation: "宿泊",
  shipbuilding: "造船・舶用工業",
  electronics: "電子電気",
  automobile_transportation: "自動車運送",
  railway: "鉄道",
  forestry: "林業",
  wood_products: "木材産業",
  other: "その他",
};

export function render(
  result: ClassifyProcedureOutput,
  lang: UILanguage,
  rootEl: HTMLElement,
  state: ClassifierState,
  cb: RenderCallbacks,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];
  const label = result.procedureLabel[lang];

  const orgDisabled = state.procedure === "renewal";
  const requiredSections = requiredSectionsForState(state);
  const omittedSections = omittedSectionsForState(state);
  const internWarningHtml = internWarningForState(state, t);

  const referencesHtml = result.references
    .map((r) => {
      const safeHref = safePrimaryHref(r.sourceUrl);
      return `<article class="card" tabindex="0" aria-label="${escapeAttr(r.title)}">
        <h5>${escapeAttr(r.title)}</h5>
        <a href="${escapeAttr(safeHref)}" rel="noopener noreferrer" target="_blank">${escapeAttr(r.sourceUrl)}</a>
        <small>${escapeAttr(t.asOf)}: ${escapeAttr(r.sourceDate)}</small>
      </article>`;
    })
    .join("");

  const confPct = Math.round(result.confidence * 100);
  const confTier = result.confidence >= 0.8 ? "high" : result.confidence >= 0.5 ? "mid" : "low";
  const assumptionsHtml =
    result.assumptions.length > 0
      ? `<details class="assumptions">
          <summary>${escapeAttr(t.assumptions)} (${result.assumptions.length})</summary>
          <ul>${result.assumptions.map((a) => `<li>${escapeAttr(a)}</li>`).join("")}</ul>
        </details>`
      : "";

  const fullHtml = `
    <div class="ssw-toolbar">${renderLanguageToggle(lang)}</div>
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <article class="decision classifier" tabindex="0" aria-label="${escapeAttr(label)}">
      <h3>${escapeAttr(t.title)}: ${escapeAttr(label)}</h3>
      <span class="conf-badge conf-badge--${confTier}">${escapeAttr(t.confidence)}: ${confPct}%</span>
      <p class="rationale">${escapeAttr(result.rationale)}</p>
      ${assumptionsHtml}
      ${stepHtml(
        t.procedure,
        "procedure",
        [
          ["coe", "認定"],
          ["change", "変更"],
          ["renewal", "更新"],
        ],
        state.procedure,
      )}
      ${stepHtml(
        t.organization,
        "organization",
        [
          ["same_fiscal_year_repeat", ORG_LABEL.same_fiscal_year_repeat],
          ["table2_1_eligible", ORG_LABEL.table2_1_eligible],
          ["listed_company", ORG_LABEL.listed_company],
          ["mutual_company", ORG_LABEL.mutual_company],
          ["innovation_company", ORG_LABEL.innovation_company],
          ["withholding_tax_10m", ORG_LABEL.withholding_tax_10m],
          ["continuous_acceptance_3y", ORG_LABEL.continuous_acceptance_3y],
          ["corporation", ORG_LABEL.corporation],
          ["sole_proprietor", ORG_LABEL.sole_proprietor],
        ],
        orgDisabled ? "not_applicable" : state.receivingOrganizationProfile,
        orgDisabled,
      )}
      ${stepHtml(
        t.applicant,
        "applicant",
        [
          ["technical_intern_2_same_field", APPLICANT_LABEL.technical_intern_2_same_field],
          [
            "technical_intern_2_different_field",
            APPLICANT_LABEL.technical_intern_2_different_field,
          ],
          ["no_exemption", APPLICANT_LABEL.no_exemption],
          ["sector_exception", APPLICANT_LABEL.sector_exception],
        ],
        state.applicantProfile,
      )}
      ${internWarningHtml}
      ${stepHtml(
        t.industry,
        "industry",
        [
          ["agriculture", INDUSTRY_LABEL.agriculture],
          ["fishery", INDUSTRY_LABEL.fishery],
          ["construction", INDUSTRY_LABEL.construction],
          ["nursing_care", INDUSTRY_LABEL.nursing_care],
          ["industrial_products_manufacturing", INDUSTRY_LABEL.industrial_products_manufacturing],
          ["building_cleaning", INDUSTRY_LABEL.building_cleaning],
          ["automobile_maintenance", INDUSTRY_LABEL.automobile_maintenance],
          ["aviation", INDUSTRY_LABEL.aviation],
          ["accommodation", INDUSTRY_LABEL.accommodation],
          ["food_service", INDUSTRY_LABEL.food_service],
          ["food_manufacturing", INDUSTRY_LABEL.food_manufacturing],
          ["shipbuilding", INDUSTRY_LABEL.shipbuilding],
          ["automobile_transportation", INDUSTRY_LABEL.automobile_transportation],
          ["railway", INDUSTRY_LABEL.railway],
          ["forestry", INDUSTRY_LABEL.forestry],
          ["wood_products", INDUSTRY_LABEL.wood_products],
          ["other", INDUSTRY_LABEL.other],
        ],
        state.industry,
      )}
      <section class="result-panel" aria-label="${escapeAttr(t.result)}">
        <h4>${escapeAttr(t.result)}</h4>
        <ul>
          ${requiredSections.map((s) => `<li><strong>${escapeAttr(sectionLabel(s))}</strong></li>`).join("")}
        </ul>
        ${
          omittedSections.length > 0
            ? `<p class="omission">省略候補: ${escapeAttr(omittedSections.map(sectionLabel).join(" / "))}</p>`
            : ""
        }
      </section>
      <div class="action-row">
        <button type="button" id="ssw-classify-commit" class="primary-action">${escapeAttr(t.followUp)}</button>
        <button type="button" id="ssw-toggle-sources" class="secondary-action">${escapeAttr(t.sources)} (${result.references.length})</button>
      </div>
    </article>
    ${state.showSources ? `<section class="refs">${referencesHtml}</section>` : ""}
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml, {
    ALLOWED_URI_REGEXP: ALLOWED_HREF,
  });

  setInnerHTML(rootEl, sanitized);
  rootEl.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.getAttribute("data-step");
      const value = button.getAttribute("data-value");
      if (step === "procedure" && isProcedure(value)) cb.onProcedureChange(value);
      if (step === "organization" && isOrganization(value)) cb.onOrganizationChange(value);
      if (step === "applicant" && isApplicant(value)) cb.onApplicantChange(value);
      if (step === "industry" && isIndustry(value)) cb.onIndustryChange(value);
    });
  });
  rootEl.querySelector("#ssw-toggle-sources")?.addEventListener("click", cb.onToggleSources);
  rootEl.querySelector("#ssw-classify-commit")?.addEventListener("click", cb.onCommit);
  wireLanguageToggle(rootEl, cb.onLangChange);

  requestAnimationFrame(() => {
    const decision = rootEl.querySelector<HTMLElement>(".decision");
    if (decision !== null) {
      decision.classList.add("entering");
      setTimeout(() => decision.classList.replace("entering", "entered"), 20);
    }
  });
}

function stepHtml(
  heading: string,
  step: string,
  options: Array<[string, string]>,
  active: string,
  disabled = false,
): string {
  return `<section class="classifier-step" aria-label="${escapeAttr(heading)}">
    <h4>${escapeAttr(heading)}</h4>
    <div class="chip-row">
      ${options
        .map(([value, label]) => {
          const selected = value === active;
          return `<button type="button" class="chip${selected ? " chip--selected" : ""}" data-step="${escapeAttr(
            step,
          )}" data-value="${escapeAttr(value)}"${disabled ? " disabled" : ""}>${escapeAttr(label)}</button>`;
        })
        .join("")}
    </div>
  </section>`;
}

function sectionLabel(section: string): string {
  if (section === "table1") return "第1表 (申請人)";
  if (section === "table2_1") return "第2表の1 (省略対象機関)";
  if (section === "table2_2") return "第2表の2 (法人)";
  if (section === "table2_3") return "第2表の3 (個人事業主)";
  return "第3表 (分野)";
}

function requiredSectionsForState(state: ClassifierState): string[] {
  const sections = ["table1"];
  if (state.procedure !== "renewal") {
    if (isTable21EligibleProfile(state.receivingOrganizationProfile)) sections.push("table2_1");
    if (state.receivingOrganizationProfile === "corporation") sections.push("table2_2");
    if (state.receivingOrganizationProfile === "sole_proprietor") sections.push("table2_3");
  }
  sections.push("table3");
  return sections;
}

function omittedSectionsForState(state: ClassifierState): string[] {
  if (
    state.procedure === "renewal" ||
    state.receivingOrganizationProfile === "same_fiscal_year_repeat"
  ) {
    return ["table2_1", "table2_2", "table2_3"];
  }
  if (isTable21EligibleProfile(state.receivingOrganizationProfile)) return ["table2_2", "table2_3"];
  if (state.receivingOrganizationProfile === "corporation") return ["table2_1", "table2_3"];
  if (state.receivingOrganizationProfile === "sole_proprietor") return ["table2_1", "table2_2"];
  return [];
}

function internWarningForState(state: ClassifierState, t: (typeof I18N)[UILanguage]): string {
  if (state.applicantProfile === "technical_intern_2_same_field") {
    return `<p class="profile-warning">${escapeAttr(t.internCheck)} ${escapeAttr(t.internSameField)}</p>`;
  }
  if (state.applicantProfile === "technical_intern_2_different_field") {
    return `<p class="profile-warning">${escapeAttr(t.internCheck)} ${escapeAttr(t.internDifferentField)}</p>`;
  }
  return "";
}

function isTable21EligibleProfile(profile: ReceivingOrganizationProfile): boolean {
  return (
    profile === "table2_1_eligible" ||
    profile === "listed_company" ||
    profile === "mutual_company" ||
    profile === "innovation_company" ||
    profile === "withholding_tax_10m" ||
    profile === "continuous_acceptance_3y"
  );
}

function isProcedure(value: string | null): value is Procedure {
  return value === "coe" || value === "change" || value === "renewal";
}

function isOrganization(value: string | null): value is ReceivingOrganizationProfile {
  return (
    value === "same_fiscal_year_repeat" ||
    value === "table2_1_eligible" ||
    value === "listed_company" ||
    value === "mutual_company" ||
    value === "innovation_company" ||
    value === "withholding_tax_10m" ||
    value === "continuous_acceptance_3y" ||
    value === "corporation" ||
    value === "sole_proprietor"
  );
}

function isApplicant(value: string | null): value is ApplicantProfile {
  return (
    value === "technical_intern_2_same_field" ||
    value === "technical_intern_2_different_field" ||
    value === "no_exemption" ||
    value === "sector_exception"
  );
}

function isIndustry(value: string | null): value is FormBundle["industry"] {
  return (
    value === "agriculture" ||
    value === "fishery" ||
    value === "food_manufacturing" ||
    value === "food_service" ||
    value === "manufacturing" ||
    value === "industrial_products_manufacturing" ||
    value === "construction" ||
    value === "nursing_care" ||
    value === "building_cleaning" ||
    value === "automobile_repair" ||
    value === "automobile_maintenance" ||
    value === "aviation" ||
    value === "lodging" ||
    value === "accommodation" ||
    value === "shipbuilding" ||
    value === "electronics" ||
    value === "automobile_transportation" ||
    value === "railway" ||
    value === "forestry" ||
    value === "wood_products" ||
    value === "other"
  );
}

import type { UILanguage, ValidateZairyuCompatibilityOutput } from "@ssw/shared-types";
import {
  escapeAttr,
  escapeHtml,
  renderLanguageToggle,
  setInnerHTML,
  wireLanguageToggle,
} from "@ssw/ui-bridge";
import DOMPurify from "dompurify";

/**
 * Two-tier disclaimer (search-visa / classify-procedure と同様):
 *   L1 brand-voice short notice 上部 / L2 server disclaimer (verbatim) 下部。
 *   H06_ILLEGAL_WORK_ALERT: ILLEGAL 判定は最上部に強い警告バナーで提示する。
 */
const L1_NOTICE_BY_LANG = {
  ja: "\u{1F4CD} 一般情報の羅針盤 — 個別案件は行政書士へ",
  en: "\u{1F4CD} Compass for general info — individual cases: gyoseishoshi",
  id: "\u{1F4CD} Kompas informasi umum — kasus individu: gyoseishoshi",
} as const;

const I18N = {
  ja: {
    heading: "在留資格と業務の適合性",
    status: { OK: "適合", WARNING: "要確認", ILLEGAL: "不法就労の可能性" },
    illegalAlert:
      "\u{26A0} この組み合わせは不法就労に該当する可能性があります。就労を開始する前に必ず専門家へ確認してください。",
    legalBasis: "根拠",
    recommendedAction: "推奨される確認事項",
    escalate: "行政書士または弁護士による確認を推奨します。",
    monitor: "在留期限の定期確認を続けてください。",
  },
  en: {
    heading: "Status–work compatibility",
    status: { OK: "Compatible", WARNING: "Needs review", ILLEGAL: "Possible illegal work" },
    illegalAlert:
      "\u{26A0} This combination may constitute illegal work. Always confirm with a professional before starting employment.",
    legalBasis: "Legal basis",
    recommendedAction: "Recommended checks",
    escalate: "Consultation with a gyoseishoshi or lawyer is recommended.",
    monitor: "Continue to monitor the residence expiry date regularly.",
  },
  id: {
    heading: "Kecocokan status–pekerjaan",
    status: { OK: "Cocok", WARNING: "Perlu ditinjau", ILLEGAL: "Mungkin kerja ilegal" },
    illegalAlert:
      "\u{26A0} Kombinasi ini mungkin termasuk kerja ilegal. Selalu konfirmasi dengan profesional sebelum mulai bekerja.",
    legalBasis: "Dasar hukum",
    recommendedAction: "Pemeriksaan yang disarankan",
    escalate: "Disarankan berkonsultasi dengan gyoseishoshi atau pengacara.",
    monitor: "Terus pantau tanggal berakhirnya izin tinggal secara berkala.",
  },
} as const;

export interface ValidateCallbacks {
  onLangChange: (lang: UILanguage) => void;
}

export function render(
  result: ValidateZairyuCompatibilityOutput,
  lang: UILanguage,
  rootEl: HTMLElement,
  cb: ValidateCallbacks,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];
  const statusLabel = t.status[result.compatibility];

  const illegalBanner =
    result.compatibility === "ILLEGAL"
      ? `<div class="illegal-alert" role="alert" aria-live="assertive">${escapeHtml(t.illegalAlert)}</div>`
      : "";

  const basisHtml =
    result.legal_basis.length > 0
      ? `<section class="basis">
          <h3>${escapeHtml(t.legalBasis)}</h3>
          <ul>${result.legal_basis.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
        </section>`
      : "";

  const ctaText = result.escalate_to_professional ? t.escalate : t.monitor;
  const ctaClass = result.escalate_to_professional ? "cta cta--escalate" : "cta";

  const html = `
    <div class="ssw-toolbar">${renderLanguageToggle(lang)}</div>
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeHtml(l1)}</small>
    ${illegalBanner}
    <article class="panel">
      <span class="badge ${escapeAttr(result.compatibility)}">${escapeHtml(statusLabel)}</span>
      <h2>${escapeHtml(t.heading)}</h2>
      <section class="action">
        <h3>${escapeHtml(t.recommendedAction)}</h3>
        <p>${escapeHtml(result.recommended_action)}</p>
      </section>
      ${basisHtml}
      <div class="${ctaClass}">${escapeHtml(ctaText)}</div>
      <p class="disclaimer">${escapeHtml(result.disclaimer)}</p>
    </article>`;

  setInnerHTML(rootEl, DOMPurify.sanitize(html));
  wireLanguageToggle(rootEl, cb.onLangChange);
}

import type { ClassifyProcedureOutput, SupportedLanguage } from "@vcj/shared-types";
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
    nextStepsHeading: "次の一般的なステップ",
    referencesHeading: "関連する公式情報源",
    asOf: "情報基準日",
    openSource: "原典を開く",
  },
  en: {
    nextStepsHeading: "Suggested next general steps",
    referencesHeading: "Related official sources",
    asOf: "As of",
    openSource: "Open source",
  },
  id: {
    nextStepsHeading: "Langkah umum berikutnya",
    referencesHeading: "Sumber resmi terkait",
    asOf: "Per tanggal",
    openSource: "Buka sumber",
  },
} as const;

const ALLOWED_HREF = /^https:\/\/(www\.)?(moj|mhlw|soumu|cao|maff|mlit)\.go\.jp\//;

function escapeAttr(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => {
    const mapped = map[c];
    return mapped !== undefined ? mapped : c;
  });
}

export function render(
  result: ClassifyProcedureOutput,
  lang: SupportedLanguage,
  rootEl: HTMLElement,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];
  const label = result.procedureLabel[lang];

  const nextStepsHtml = result.nextSteps.map((step) => `<li>${escapeAttr(step)}</li>`).join("");

  const referencesHtml = result.references
    .map((r) => {
      const safeHref = ALLOWED_HREF.test(r.sourceUrl) ? r.sourceUrl : "#";
      return `<article class="card" tabindex="0" aria-label="${escapeAttr(r.title)}">
        <h5>${escapeAttr(r.title)}</h5>
        <a href="${escapeAttr(safeHref)}" rel="noopener noreferrer" target="_blank">${t.openSource}</a>
        <small>${escapeAttr(t.asOf)}: ${escapeAttr(r.sourceDate)}</small>
      </article>`;
    })
    .join("");

  const fullHtml = `
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <article class="decision" tabindex="0" aria-label="${escapeAttr(label)}">
      <h3>${escapeAttr(label)}</h3>
      <p class="rationale">${escapeAttr(result.rationale)}</p>
      <h4 class="sr-heading">${escapeAttr(t.nextStepsHeading)}</h4>
      <ol class="next-steps">${nextStepsHtml}</ol>
    </article>
    <section class="refs" aria-labelledby="vcj-refs-heading">
      <h4 id="vcj-refs-heading">${escapeAttr(t.referencesHeading)}</h4>
      ${referencesHtml}
    </section>
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml, {
    ALLOWED_URI_REGEXP: ALLOWED_HREF,
  });

  rootEl.innerHTML = sanitized;

  requestAnimationFrame(() => {
    const decision = rootEl.querySelector<HTMLElement>(".decision");
    if (decision !== null) {
      decision.classList.add("entering");
      setTimeout(() => decision.classList.replace("entering", "entered"), 20);
    }
  });
}

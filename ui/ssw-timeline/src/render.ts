import type { GetDeadlineTimelineOutput, UILanguage } from "@ssw/shared-types";
import { setInnerHTML } from "@ssw/ui-bridge";
import DOMPurify from "dompurify";

/**
 * Two-tier disclaimer (ADR-002 / search-visa / classify-procedure):
 *   L1 brand-voice short notice at the top.
 *   L2 full server-provided disclaimer (DISCLAIMER_BY_LANG, v2 §5.1 verbatim)
 *   at the bottom. UI MUST NOT truncate, reflow, or re-format L2.
 */
const L1_NOTICE_BY_LANG = {
  ja: "\u{1F4CD} 一般情報の羅針盤 — 個別案件は行政書士へ",
  en: "\u{1F4CD} Compass for general info — individual cases: gyoseishoshi",
  id: "\u{1F4CD} Kompas informasi umum — kasus individu: gyoseishoshi",
} as const;

const I18N = {
  ja: {
    timelineHeading: "期限タイムライン",
    asOf: "情報基準日",
    dueByPrefix: "期限 (目安)",
    relatedForms: "関連様式",
    trustLevel: {
      primary_source: "一次情報",
      secondary: "二次情報",
      community: "コミュニティ情報",
    },
  },
  en: {
    timelineHeading: "Deadline timeline",
    asOf: "As of",
    dueByPrefix: "Due (approx.)",
    relatedForms: "Related forms",
    trustLevel: {
      primary_source: "Primary source",
      secondary: "Secondary",
      community: "Community",
    },
  },
  id: {
    timelineHeading: "Linimasa tenggat waktu",
    asOf: "Per tanggal",
    dueByPrefix: "Tenggat (kira-kira)",
    relatedForms: "Formulir terkait",
    trustLevel: {
      primary_source: "Sumber utama",
      secondary: "Sekunder",
      community: "Komunitas",
    },
  },
} as const;

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
  result: GetDeadlineTimelineOutput,
  lang: UILanguage,
  rootEl: HTMLElement,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];

  const deadlineHtml = result.deadlines
    .map((d) => {
      const labelText = d.label[lang];
      const relativeText = d.relativeLabel[lang];
      const trustText = t.trustLevel[d.trustLevel];
      const dueByHtml =
        d.dueBy !== undefined
          ? `<span class="due-by">${escapeAttr(t.dueByPrefix)}: ${escapeAttr(d.dueBy)}</span>`
          : "";
      const formsHtml =
        d.relatedForms !== undefined && d.relatedForms.length > 0
          ? `<div class="related-forms"><strong>${escapeAttr(t.relatedForms)}</strong><ul>${d.relatedForms
              .map(
                (form) =>
                  `<li><a href="${escapeAttr(form.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeAttr(form.title)}</a></li>`,
              )
              .join("")}</ul></div>`
          : "";
      const trustClass =
        d.trustLevel === "primary_source"
          ? "trust-badge trust-badge--primary"
          : d.trustLevel === "secondary"
            ? "trust-badge trust-badge--secondary"
            : "trust-badge trust-badge--community";
      return `<li class="deadline" tabindex="0" aria-label="${escapeAttr(labelText)}">
        <h3>${escapeAttr(labelText)} <span class="${trustClass}" aria-label="${escapeAttr(trustText)}">${escapeAttr(trustText)}</span></h3>
        <span class="relative">${escapeAttr(relativeText)}</span>${dueByHtml}
        <p class="description">${escapeAttr(d.description)}</p>
        ${formsHtml}
      </li>`;
    })
    .join("");

  const fullHtml = `
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <section aria-labelledby="ssw-timeline-heading">
      <h2 id="ssw-timeline-heading" class="sr-only">${escapeAttr(t.timelineHeading)}</h2>
      <ul class="timeline">${deadlineHtml}</ul>
    </section>
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml);

  setInnerHTML(rootEl, sanitized);

  requestAnimationFrame(() => {
    const rows = rootEl.querySelectorAll<HTMLElement>(".deadline");
    rows.forEach((el, i) => {
      el.classList.add("entering");
      setTimeout(() => el.classList.replace("entering", "entered"), i * 50);
    });
  });
}

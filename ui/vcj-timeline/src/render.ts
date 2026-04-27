import type { GetDeadlineTimelineOutput, SupportedLanguage } from "@vcj/shared-types";
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
    referencesHeading: "関連する公式情報源",
    asOf: "情報基準日",
    openSource: "原典を開く",
    dueByPrefix: "期限 (目安)",
    trustLevel: {
      primary_source: "一次情報",
      secondary: "二次情報",
      community: "コミュニティ情報",
    },
  },
  en: {
    timelineHeading: "Deadline timeline",
    referencesHeading: "Related official sources",
    asOf: "As of",
    openSource: "Open source",
    dueByPrefix: "Due (approx.)",
    trustLevel: {
      primary_source: "Primary source",
      secondary: "Secondary",
      community: "Community",
    },
  },
  id: {
    timelineHeading: "Linimasa tenggat waktu",
    referencesHeading: "Sumber resmi terkait",
    asOf: "Per tanggal",
    openSource: "Buka sumber",
    dueByPrefix: "Tenggat (kira-kira)",
    trustLevel: {
      primary_source: "Sumber utama",
      secondary: "Sekunder",
      community: "Komunitas",
    },
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
  result: GetDeadlineTimelineOutput,
  lang: SupportedLanguage,
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
      </li>`;
    })
    .join("");

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
    <section aria-labelledby="vcj-timeline-heading">
      <h2 id="vcj-timeline-heading" class="sr-only">${escapeAttr(t.timelineHeading)}</h2>
      <ul class="timeline">${deadlineHtml}</ul>
    </section>
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
    const rows = rootEl.querySelectorAll<HTMLElement>(".deadline");
    rows.forEach((el, i) => {
      el.classList.add("entering");
      setTimeout(() => el.classList.replace("entering", "entered"), i * 50);
    });
  });
}

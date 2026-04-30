import type { SearchVisaOutput, UILanguage } from "@ssw/shared-types";
import { setInnerHTML } from "@ssw/ui-bridge";
import DOMPurify from "dompurify";

/**
 * Two-tier disclaimer model.
 *
 * L1 — brand-voice short notice. Rendered as <small> at the top. Purpose:
 *   communicate the Compass metaphor in 1 line so users understand the product
 *   boundary before reading results.
 *
 * L2 — full server-provided disclaimer (DISCLAIMER_BY_LANG, v2 §5.1). Rendered
 *   as <p role="note"> immediately below the results. Purpose: regulatory
 *   compliance — 行政書士法 §19-1 defense. The UI MUST pass this through
 *   verbatim; no truncation, reflowing, or re-formatting.
 */
const L1_NOTICE_BY_LANG = {
  ja: "\u{1F4CD} 一般情報の羅針盤 — 個別案件は行政書士へ",
  en: "\u{1F4CD} Compass for general info — individual cases: gyoseishoshi",
  id: "\u{1F4CD} Kompas informasi umum — kasus individu: gyoseishoshi",
} as const;

const I18N = {
  ja: {
    summary: "公式情報源にもとづく要点",
    sources: "出典を確認",
    asOf: "情報基準日",
    openSource: "原典を開く",
    followups: ["申請種別を判定する", "必要書類を確認する", "期限を確認する"],
  },
  en: {
    summary: "Key points from official sources",
    sources: "Show sources",
    asOf: "As of",
    openSource: "Open source",
    followups: ["Classify procedure", "Check documents", "Check deadlines"],
  },
  id: {
    summary: "Poin utama dari sumber resmi",
    sources: "Tampilkan sumber",
    asOf: "Per tanggal",
    openSource: "Buka sumber",
    followups: ["Klasifikasi prosedur", "Periksa dokumen", "Periksa tenggat"],
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
  result: SearchVisaOutput,
  lang: UILanguage,
  rootEl: HTMLElement,
  showSources: boolean,
  onToggleSources: () => void,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];

  const cardsHtml = result.results
    .map((r) => {
      const safeHref = ALLOWED_HREF.test(r.sourceUrl) ? r.sourceUrl : "#";
      return `<article class="card" tabindex="0" aria-label="${escapeAttr(r.title)}">
        <h3>${escapeAttr(r.title)}</h3>
        <p>${escapeAttr(r.snippet)}</p>
        <a href="${escapeAttr(safeHref)}" rel="noopener noreferrer" target="_blank">${t.openSource}</a>
        <small>${t.asOf}: ${escapeAttr(r.sourceDate)}</small>
      </article>`;
    })
    .join("");

  const fullHtml = `
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <article class="summary-card">
      <h2>${escapeAttr(t.summary)}</h2>
      <p>${escapeAttr(summaryText(result))}</p>
      <div class="followup-row">
        ${t.followups.map((f) => `<span class="followup-chip">${escapeAttr(f)}</span>`).join("")}
      </div>
      <button type="button" id="ssw-toggle-sources" class="sources-chip">${escapeAttr(t.sources)} (${result.results.length})</button>
    </article>
    ${
      showSources
        ? `<section aria-labelledby="ssw-sources-heading">
            <h2 id="ssw-sources-heading" class="sr-only">${escapeAttr(t.sources)}</h2>
            ${cardsHtml}
          </section>`
        : ""
    }
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml, {
    ALLOWED_URI_REGEXP: ALLOWED_HREF,
  });

  setInnerHTML(rootEl, sanitized);
  rootEl.querySelector("#ssw-toggle-sources")?.addEventListener("click", onToggleSources);

  requestAnimationFrame(() => {
    const cards = rootEl.querySelectorAll<HTMLElement>(".card");
    cards.forEach((el, i) => {
      el.classList.add("entering");
      setTimeout(() => el.classList.replace("entering", "entered"), i * 60);
    });
  });
}

function summaryText(result: SearchVisaOutput): string {
  const first = result.results[0];
  if (first === undefined) {
    return "公式情報源で該当する内容が見つかりませんでした。";
  }
  const titles = result.results
    .slice(0, 3)
    .map((r) => r.title)
    .join(" / ");
  return `${result.results.length}件の一次情報を確認しました。まずは申請種別、必要書類、期限の順に確認してください。主な根拠: ${titles}`;
}

import type { SearchVisaOutput, UILanguage } from "@ssw/shared-types";
import {
  attachCopyButton,
  escapeAttr,
  renderLanguageToggle,
  safePrimaryHref,
  setInnerHTML,
  wireLanguageToggle,
} from "@ssw/ui-bridge";
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
    confidence: "信頼度",
    copyUrl: "URLをコピー",
    copyAll: "出典URLをすべてコピー",
    copied: "コピーしました",
    copyFailed: "コピー失敗",
    empty: "公式情報源で該当する内容が見つかりませんでした。条件を変えてもう一度お試しください。",
    summaryLead: (n: number) =>
      `${n}件の一次情報を確認しました。まずは申請種別 → 必要書類 → 期限の順に確認してください。`,
    followups: ["申請種別を判定する", "必要書類を確認する", "期限を確認する"],
  },
  en: {
    summary: "Key points from official sources",
    sources: "Show sources",
    asOf: "As of",
    openSource: "Open source",
    confidence: "Confidence",
    copyUrl: "Copy URL",
    copyAll: "Copy all source URLs",
    copied: "Copied",
    copyFailed: "Copy failed",
    empty: "No matching content was found in official sources. Try adjusting your query.",
    summaryLead: (n: number) =>
      `Checked ${n} primary source(s). Review in order: procedure type → documents → deadlines.`,
    followups: ["Classify procedure", "Check documents", "Check deadlines"],
  },
  id: {
    summary: "Poin utama dari sumber resmi",
    sources: "Tampilkan sumber",
    asOf: "Per tanggal",
    openSource: "Buka sumber",
    confidence: "Keyakinan",
    copyUrl: "Salin URL",
    copyAll: "Salin semua URL sumber",
    copied: "Tersalin",
    copyFailed: "Gagal menyalin",
    empty: "Tidak ada konten yang cocok di sumber resmi. Coba ubah kueri Anda.",
    summaryLead: (n: number) =>
      `Memeriksa ${n} sumber utama. Tinjau berurutan: jenis prosedur → dokumen → tenggat.`,
    followups: ["Klasifikasi prosedur", "Periksa dokumen", "Periksa tenggat"],
  },
} as const;

const ALLOWED_HREF = /^https:\/\/(www\.)?(moj|mhlw|soumu|cao|maff|mlit)\.go\.jp\//;

export interface SearchCallbacks {
  onToggleSources: () => void;
  onLangChange: (lang: UILanguage) => void;
}

export function render(
  result: SearchVisaOutput,
  lang: UILanguage,
  rootEl: HTMLElement,
  showSources: boolean,
  cb: SearchCallbacks,
): void {
  const t = I18N[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];

  const cardsHtml = result.results
    .map((r, i) => {
      const safeHref = safePrimaryHref(r.sourceUrl);
      const confPct = Math.round(r.confidence * 100);
      return `<article class="card" tabindex="0" aria-label="${escapeAttr(r.title)}">
        <h3>${escapeAttr(r.title)}</h3>
        <p>${escapeAttr(r.snippet)}</p>
        <div class="conf" aria-label="${escapeAttr(t.confidence)} ${confPct}%">
          <span class="conf-label">${escapeAttr(t.confidence)} ${confPct}%</span>
          <span class="conf-track"><span class="conf-fill" data-conf="${confPct}"></span></span>
        </div>
        <div class="card-actions">
          <a href="${escapeAttr(safeHref)}" rel="noopener noreferrer" target="_blank">${escapeAttr(t.openSource)}</a>
          <button type="button" class="ssw-copy-btn" data-copy-idx="${i}">${escapeAttr(t.copyUrl)}</button>
        </div>
        <small>${escapeAttr(t.asOf)}: ${escapeAttr(r.sourceDate)}</small>
      </article>`;
    })
    .join("");

  const hasResults = result.results.length > 0;
  const copyAllHtml = hasResults
    ? `<button type="button" class="ssw-copy-btn" id="ssw-copy-all">${escapeAttr(t.copyAll)}</button>`
    : "";

  const summaryBody = hasResults
    ? `<p>${escapeAttr(summaryText(result, t))}</p>
      <div class="followup-row">
        ${t.followups.map((f) => `<span class="followup-chip">${escapeAttr(f)}</span>`).join("")}
      </div>
      <div class="summary-actions">
        <button type="button" id="ssw-toggle-sources" class="sources-chip" aria-expanded="${showSources ? "true" : "false"}">${escapeAttr(t.sources)} (${result.results.length})</button>
        ${copyAllHtml}
      </div>`
    : `<p class="empty-state" role="status">${escapeAttr(t.empty)}</p>`;

  const fullHtml = `
    <div class="ssw-toolbar">${renderLanguageToggle(lang)}</div>
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <article class="summary-card">
      <h2>${escapeAttr(t.summary)}</h2>
      ${summaryBody}
    </article>
    ${
      showSources && hasResults
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

  // confidence bar の幅は CSS 変数経由 (HTML 文字列に inline style を入れず CSP 適合)。
  for (const fill of Array.from(rootEl.querySelectorAll<HTMLElement>(".conf-fill"))) {
    const conf = fill.getAttribute("data-conf");
    if (conf !== null) fill.style.width = `${conf}%`;
  }

  rootEl.querySelector("#ssw-toggle-sources")?.addEventListener("click", cb.onToggleSources);
  wireLanguageToggle(rootEl, cb.onLangChange);

  const copyLabels = { idle: t.copyUrl, done: t.copied, failed: t.copyFailed };
  for (const button of Array.from(rootEl.querySelectorAll<HTMLButtonElement>("[data-copy-idx]"))) {
    const idx = Number(button.getAttribute("data-copy-idx"));
    const entry = result.results[idx];
    if (entry !== undefined) {
      attachCopyButton(button, () => entry.sourceUrl, copyLabels);
    }
  }
  const copyAllBtn = rootEl.querySelector<HTMLButtonElement>("#ssw-copy-all");
  if (copyAllBtn !== null) {
    attachCopyButton(copyAllBtn, () => result.results.map((r) => r.sourceUrl).join("\n"), {
      idle: t.copyAll,
      done: t.copied,
      failed: t.copyFailed,
    });
  }

  requestAnimationFrame(() => {
    const cards = rootEl.querySelectorAll<HTMLElement>(".card");
    cards.forEach((el, i) => {
      el.classList.add("entering");
      setTimeout(() => el.classList.replace("entering", "entered"), i * 60);
    });
  });
}

function summaryText(result: SearchVisaOutput, t: (typeof I18N)[UILanguage]): string {
  const titles = result.results
    .slice(0, 3)
    .map((r) => r.title)
    .join(" / ");
  return `${t.summaryLead(result.results.length)} ${titles}`;
}

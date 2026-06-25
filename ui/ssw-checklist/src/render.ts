import type { ListVisaDocumentsOutput, UILanguage } from "@ssw/shared-types";
import {
  attachCopyButton,
  escapeAttr,
  renderLanguageToggle,
  safePrimaryHref,
  setInnerHTML,
  wireLanguageToggle,
} from "@ssw/ui-bridge";
import DOMPurify from "dompurify";
import type { ChecklistState } from "./state.js";
import { containsPii, isDirty } from "./state.js";

export interface RenderCallbacks {
  onToggle: (id: string) => void;
  onNotesChange: (notes: string) => void;
  onCommit: () => void;
  onLangChange: (lang: UILanguage) => void;
}

const L1_NOTICE_BY_LANG = {
  ja: "\u{1F4CD} 一般情報の羅針盤 — 個別案件は行政書士へ",
  en: "\u{1F4CD} Compass for general info — individual cases: gyoseishoshi",
  id: "\u{1F4CD} Kompas informasi umum — kasus individu: gyoseishoshi",
} as const;

const I18N = {
  ja: {
    notesLabel: "備考 (任意、個人情報は入力しないでください)",
    notesPlaceholder: "例: 農業分野を希望している、試験は来月受験予定 など",
    commit: "この内容でAIに次の質問をする",
    commitNoChange: "変更がないと送信できません",
    commitSent: "送信済み。必要があれば変更して再送信できます。",
    piiWarning:
      "個人番号・在留カード番号・パスポート番号は入力できません。" +
      "一般的な説明のみ備考に記入してください。",
    groups: {
      table1: "第1表: 申請人",
      table2: "第2表: 所属機関",
      table3: "第3表: 分野",
      reference_form: "参考様式",
      omission: "省略候補",
    },
    statuses: {
      required: "必須",
      omitted_due_to_category: "条件により省略",
      applicant_specific: "申請人次第",
      sector_specific: "分野別",
    },
    multilingualBadge: "母国語確認",
    translatedTemplateBadge: "多言語様式あり",
    asOf: "情報基準日",
    ministryPrefix: "所管",
    openSource: "原典を開く",
    progress: "確認済み",
    copyChecklist: "リストをコピー",
    copied: "コピーしました",
    copyFailed: "コピー失敗",
  },
  en: {
    notesLabel: "Notes (optional, do not include personal identifiers)",
    notesPlaceholder: "e.g., Planning for the agriculture sector; will take the test next month",
    commit: "Ask the AI with these selections",
    commitNoChange: "No changes to submit yet",
    commitSent: "Sent. You can modify and resubmit at any time.",
    piiWarning:
      "Residence card numbers, passport numbers and individual numbers cannot be entered. " +
      "Please write only general information in the notes.",
    groups: {
      table1: "Table 1: Applicant",
      table2: "Table 2: Organization",
      table3: "Table 3: Industry",
      reference_form: "Reference forms",
      omission: "Omission candidates",
    },
    statuses: {
      required: "Required",
      omitted_due_to_category: "Omission possible",
      applicant_specific: "Applicant-specific",
      sector_specific: "Sector-specific",
    },
    multilingualBadge: "Native-language check",
    translatedTemplateBadge: "Translations available",
    asOf: "As of",
    ministryPrefix: "Ministry",
    openSource: "Open source",
    progress: "Checked",
    copyChecklist: "Copy list",
    copied: "Copied",
    copyFailed: "Copy failed",
  },
  id: {
    notesLabel: "Catatan (opsional, jangan masukkan pengenal pribadi)",
    notesPlaceholder: "contoh: Rencana sektor pertanian; akan ujian bulan depan",
    commit: "Tanya AI dengan pilihan ini",
    commitNoChange: "Belum ada perubahan untuk dikirim",
    commitSent: "Terkirim. Anda dapat mengubah dan mengirim ulang kapan saja.",
    piiWarning:
      "Nomor kartu tinggal, nomor paspor, dan nomor individu tidak dapat dimasukkan. " +
      "Tuliskan hanya informasi umum pada catatan.",
    groups: {
      table1: "Tabel 1: Pemohon",
      table2: "Tabel 2: Organisasi",
      table3: "Tabel 3: Bidang",
      reference_form: "Formulir referensi",
      omission: "Kandidat penghilangan",
    },
    statuses: {
      required: "Wajib",
      omitted_due_to_category: "Dapat dihilangkan",
      applicant_specific: "Tergantung pemohon",
      sector_specific: "Khusus sektor",
    },
    multilingualBadge: "Cek bahasa ibu",
    translatedTemplateBadge: "Terjemahan tersedia",
    asOf: "Per tanggal",
    ministryPrefix: "Kementerian",
    openSource: "Buka sumber",
    progress: "Diperiksa",
    copyChecklist: "Salin daftar",
    copied: "Tersalin",
    copyFailed: "Gagal menyalin",
  },
} as const;

const TRUST_LABEL_BY_LANG = {
  ja: { primary_source: "一次情報", secondary: "二次情報", community: "コミュニティ情報" },
  en: { primary_source: "Primary source", secondary: "Secondary", community: "Community" },
  id: { primary_source: "Sumber utama", secondary: "Sekunder", community: "Komunitas" },
} as const;

function trustClass(trustLevel: string): string {
  if (trustLevel === "primary_source") return "trust-badge trust-badge--primary";
  if (trustLevel === "secondary") return "trust-badge trust-badge--secondary";
  return "trust-badge trust-badge--community";
}

export interface RenderContext {
  result: ListVisaDocumentsOutput;
  state: ChecklistState;
  lastCommitted: ChecklistState | null;
  lang: UILanguage;
  committedOnce: boolean;
}

export function render(ctx: RenderContext, rootEl: HTMLElement, cb: RenderCallbacks): void {
  const { result, state, lastCommitted, lang, committedOnce } = ctx;
  const t = I18N[lang];
  const trustLabels = TRUST_LABEL_BY_LANG[lang];
  const l1 = L1_NOTICE_BY_LANG[lang];

  const notesHasPii = containsPii(state.notes);
  const dirty = isDirty(state, lastCommitted);
  const canCommit = dirty && !notesHasPii;

  const groups = ["table1", "table2", "table3", "reference_form", "omission"] as const;
  const rowsHtml = groups
    .map((group) => {
      const docs = result.documents.filter((d) => d.group === group);
      if (docs.length === 0) return "";
      const items = docs
        .map((d) => {
          const labelText = d.label[lang];
          const trustText = trustLabels[d.trustLevel];
          const checked = state.checkedDocIds.has(d.id);
          const ministryHtml =
            d.ministry !== undefined && d.ministry.length > 0
              ? `<small class="ministry">${escapeAttr(t.ministryPrefix)}: ${escapeAttr(d.ministry)}</small>`
              : "";
          const multilingualBadges = [
            d.applicantUnderstandingRequired === true
              ? `<span class="language-badge language-badge--required">${escapeAttr(t.multilingualBadge)}</span>`
              : "",
            d.multilingualTemplateAvailable === true
              ? `<span class="language-badge language-badge--available">${escapeAttr(t.translatedTemplateBadge)}</span>`
              : "",
          ].join("");
          const multilingualSourceHtml =
            d.multilingualSourceUrl !== undefined && d.multilingualSourceUrl.length > 0
              ? `<small class="language-source">${escapeAttr(d.multilingualSourceUrl)}</small>`
              : "";
          const sourceLinkHtml =
            d.sourceUrl !== undefined && d.sourceUrl.length > 0
              ? `<a class="doc-source" href="${escapeAttr(safePrimaryHref(d.sourceUrl))}" target="_blank" rel="noopener noreferrer">${escapeAttr(t.openSource)}</a>`
              : "";
          return `<li class="doc-row">
            <input type="checkbox" id="doc-${escapeAttr(d.id)}"${checked ? " checked" : ""} data-doc-id="${escapeAttr(d.id)}" />
            <div class="doc-meta">
              <label class="doc-label" for="doc-${escapeAttr(d.id)}">
                <h3>${escapeAttr(labelText)} <span class="status-badge status-${escapeAttr(d.status)}">${escapeAttr(t.statuses[d.status])}</span> <span class="${trustClass(d.trustLevel)}" aria-label="${escapeAttr(trustText)}">${escapeAttr(trustText)}</span></h3>
              </label>
              <p class="desc">${escapeAttr(d.description)}</p>
              <div class="language-badges">${multilingualBadges}</div>
              ${ministryHtml}
              ${sourceLinkHtml}
              ${multilingualSourceHtml}
            </div>
          </li>`;
        })
        .join("");
      return `<section class="doc-group" aria-label="${escapeAttr(t.groups[group])}">
        <h2>${escapeAttr(t.groups[group])}</h2>
        <ul>${items}</ul>
      </section>`;
    })
    .join("");

  const commitDisabled = !canCommit;
  const commitStatus = notesHasPii
    ? t.piiWarning
    : dirty
      ? ""
      : committedOnce
        ? t.commitSent
        : t.commitNoChange;

  const totalDocs = result.documents.length;
  const checkedCount = state.checkedDocIds.size;
  const progressPct = totalDocs > 0 ? Math.round((checkedCount / totalDocs) * 100) : 0;

  const fullHtml = `
    <div class="ssw-toolbar">${renderLanguageToggle(lang)}</div>
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <div class="progress-bar" role="group" aria-label="${escapeAttr(t.progress)}">
      <span class="progress-count">${escapeAttr(t.progress)}: ${checkedCount} / ${totalDocs}</span>
      <span class="progress-track"><span class="progress-fill" data-progress="${progressPct}"></span></span>
      <button type="button" class="ssw-copy-btn" id="ssw-copy-checklist">${escapeAttr(t.copyChecklist)}</button>
    </div>
    <div class="doc-list">${rowsHtml}</div>
    <div class="notes">
      <label for="ssw-notes">${escapeAttr(t.notesLabel)}</label>
      <textarea id="ssw-notes" placeholder="${escapeAttr(t.notesPlaceholder)}">${escapeAttr(state.notes)}</textarea>
    </div>
    <div class="toast${notesHasPii ? " visible" : ""}" role="alert" aria-live="assertive">${escapeAttr(t.piiWarning)}</div>
    <div class="commit-bar">
      <button type="button" class="commit-btn" id="ssw-commit-btn"${commitDisabled ? " disabled" : ""}>
        ${escapeAttr(t.commit)}
      </button>
      <span class="commit-status">${escapeAttr(commitStatus)}</span>
    </div>
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml);
  setInnerHTML(rootEl, sanitized);

  const progressFill = rootEl.querySelector<HTMLElement>(".progress-fill");
  if (progressFill !== null) {
    progressFill.style.width = `${progressPct}%`;
  }

  wireLanguageToggle(rootEl, cb.onLangChange);

  const copyBtn = rootEl.querySelector<HTMLButtonElement>("#ssw-copy-checklist");
  if (copyBtn !== null) {
    attachCopyButton(copyBtn, () => buildChecklistText(result, lang, t), {
      idle: t.copyChecklist,
      done: t.copied,
      failed: t.copyFailed,
    });
  }

  for (const checkbox of Array.from(
    rootEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-doc-id]'),
  )) {
    checkbox.addEventListener("change", () => {
      const id = checkbox.getAttribute("data-doc-id");
      if (id !== null) cb.onToggle(id);
    });
  }

  const textarea = rootEl.querySelector<HTMLTextAreaElement>("#ssw-notes");
  if (textarea !== null) {
    textarea.addEventListener("input", () => {
      cb.onNotesChange(textarea.value);
    });
  }

  const commitBtn = rootEl.querySelector<HTMLButtonElement>("#ssw-commit-btn");
  if (commitBtn !== null) {
    commitBtn.addEventListener("click", () => {
      if (!commitBtn.disabled) cb.onCommit();
    });
  }
}

/**
 * クリップボード用のプレーンテキスト書類リストを生成する (グループ別・出典付き)。
 * Builds a plain-text checklist for clipboard (grouped, with sources).
 * Membangun daftar dokumen teks polos untuk clipboard (per grup, dengan sumber).
 */
function buildChecklistText(
  result: ListVisaDocumentsOutput,
  lang: UILanguage,
  t: (typeof I18N)[UILanguage],
): string {
  const groups = ["table1", "table2", "table3", "reference_form", "omission"] as const;
  const lines: string[] = [];
  for (const group of groups) {
    const docs = result.documents.filter((d) => d.group === group);
    if (docs.length === 0) continue;
    lines.push(`# ${t.groups[group]}`);
    for (const d of docs) {
      const status = t.statuses[d.status];
      const source = d.sourceUrl !== undefined && d.sourceUrl.length > 0 ? `  ${d.sourceUrl}` : "";
      lines.push(`- [${status}] ${d.label[lang]}${source}`);
    }
    lines.push("");
  }
  lines.push(`${t.asOf}: ${result.asOf}`);
  return lines.join("\n");
}

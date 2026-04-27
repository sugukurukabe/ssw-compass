import type { ListVisaDocumentsOutput, SupportedLanguage } from "@vcj/shared-types";
import DOMPurify from "dompurify";
import type { ChecklistState } from "./state.js";
import { containsPii, isDirty } from "./state.js";

export interface RenderCallbacks {
  onToggle: (id: string) => void;
  onNotesChange: (notes: string) => void;
  onCommit: () => void;
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
    asOf: "情報基準日",
    ministryPrefix: "所管",
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
    asOf: "As of",
    ministryPrefix: "Ministry",
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
    asOf: "Per tanggal",
    ministryPrefix: "Kementerian",
  },
} as const;

const TRUST_LABEL_BY_LANG = {
  ja: { primary_source: "一次情報", secondary: "二次情報", community: "コミュニティ情報" },
  en: { primary_source: "Primary source", secondary: "Secondary", community: "Community" },
  id: { primary_source: "Sumber utama", secondary: "Sekunder", community: "Komunitas" },
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

function trustClass(trustLevel: string): string {
  if (trustLevel === "primary_source") return "trust-badge trust-badge--primary";
  if (trustLevel === "secondary") return "trust-badge trust-badge--secondary";
  return "trust-badge trust-badge--community";
}

export interface RenderContext {
  result: ListVisaDocumentsOutput;
  state: ChecklistState;
  lastCommitted: ChecklistState | null;
  lang: SupportedLanguage;
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

  const rowsHtml = result.documents
    .map((d) => {
      const labelText = d.label[lang];
      const trustText = trustLabels[d.trustLevel];
      const checked = state.checkedDocIds.has(d.id);
      const ministryHtml =
        d.ministry !== undefined && d.ministry.length > 0
          ? `<small class="ministry">${escapeAttr(t.ministryPrefix)}: ${escapeAttr(d.ministry)}</small>`
          : "";
      return `<li class="doc-row">
        <input type="checkbox" id="doc-${escapeAttr(d.id)}"${checked ? " checked" : ""} data-doc-id="${escapeAttr(d.id)}" />
        <div class="doc-meta">
          <label class="doc-label" for="doc-${escapeAttr(d.id)}">
            <h3>${escapeAttr(labelText)} <span class="${trustClass(d.trustLevel)}" aria-label="${escapeAttr(trustText)}">${escapeAttr(trustText)}</span></h3>
          </label>
          <p class="desc">${escapeAttr(d.description)}</p>
          ${ministryHtml}
        </div>
      </li>`;
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

  const fullHtml = `
    <small class="notice-l1" role="note" aria-label="service scope notice">${escapeAttr(l1)}</small>
    <ul class="doc-list">${rowsHtml}</ul>
    <div class="notes">
      <label for="vcj-notes">${escapeAttr(t.notesLabel)}</label>
      <textarea id="vcj-notes" placeholder="${escapeAttr(t.notesPlaceholder)}">${escapeAttr(state.notes)}</textarea>
    </div>
    <div class="toast${notesHasPii ? " visible" : ""}" role="alert" aria-live="assertive">${escapeAttr(t.piiWarning)}</div>
    <div class="commit-bar">
      <button type="button" class="commit-btn" id="vcj-commit-btn"${commitDisabled ? " disabled" : ""}>
        ${escapeAttr(t.commit)}
      </button>
      <span class="commit-status">${escapeAttr(commitStatus)}</span>
    </div>
    <p role="note" class="disclaimer">${escapeAttr(result.disclaimer)}</p>
    <p class="meta">${escapeAttr(t.asOf)}: ${escapeAttr(result.asOf)}</p>
  `;

  const sanitized = DOMPurify.sanitize(fullHtml);
  rootEl.innerHTML = sanitized;

  for (const checkbox of Array.from(
    rootEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-doc-id]'),
  )) {
    checkbox.addEventListener("change", () => {
      const id = checkbox.getAttribute("data-doc-id");
      if (id !== null) cb.onToggle(id);
    });
  }

  const textarea = rootEl.querySelector<HTMLTextAreaElement>("#vcj-notes");
  if (textarea !== null) {
    textarea.addEventListener("input", () => {
      cb.onNotesChange(textarea.value);
    });
  }

  const commitBtn = rootEl.querySelector<HTMLButtonElement>("#vcj-commit-btn");
  if (commitBtn !== null) {
    commitBtn.addEventListener("click", () => {
      if (!commitBtn.disabled) cb.onCommit();
    });
  }
}

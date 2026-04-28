import type { ListVisaDocumentsOutput, UILanguage } from "@ssw/shared-types";

/**
 * Checklist state, treated as immutable in the UI. Pages are not persisted
 * across iframe reloads (Sprint 2 Batch 5 Interface Freeze Q3 = option A).
 */
export interface ChecklistState {
  readonly checkedDocIds: ReadonlySet<string>;
  readonly notes: string;
}

export const EMPTY_STATE: ChecklistState = {
  checkedDocIds: new Set<string>(),
  notes: "",
};

export function toggleDocId(state: ChecklistState, id: string): ChecklistState {
  const next = new Set(state.checkedDocIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return { ...state, checkedDocIds: next };
}

export function setNotes(state: ChecklistState, notes: string): ChecklistState {
  return { ...state, notes };
}

export function isDirty(current: ChecklistState, lastCommitted: ChecklistState | null): boolean {
  if (lastCommitted === null) return current.checkedDocIds.size > 0 || current.notes.length > 0;
  if (current.notes !== lastCommitted.notes) return true;
  if (current.checkedDocIds.size !== lastCommitted.checkedDocIds.size) return true;
  for (const id of current.checkedDocIds) {
    if (!lastCommitted.checkedDocIds.has(id)) return true;
  }
  return false;
}

/**
 * UI-side PII regex — belt-and-braces ahead of the server-side
 * scrubInputForPII. Mirrors the three primary blocking patterns
 * (in-card number, my number with a hotword not required here because UI
 * is already a user-typed notes field, and passport number).
 */
const ZAIRYU = /\b[A-Z]{2}[0-9]{8}[A-Z]{2}\b/;
const MY_NUMBER = /\b\d{12}\b/;
const PASSPORT = /\b[A-Z]{1,2}\d{7}\b/;

export function containsPii(notes: string): boolean {
  return ZAIRYU.test(notes) || MY_NUMBER.test(notes) || PASSPORT.test(notes);
}

/**
 * Compose the Commit Moment text the UI will send to the host via
 * `app.updateModelContext`. Format follows v3 §21.2 — short, deterministic,
 * language-specific; never leaks the user's notes raw into structured logs.
 */
export function buildCommitSummary(
  state: ChecklistState,
  docs: ListVisaDocumentsOutput,
  lang: UILanguage,
): string {
  const checked = docs.documents.filter((d) => state.checkedDocIds.has(d.id));
  const labels = checked.map((d) => d.label[lang]);
  const heads = {
    ja: "user は次の書類を確認済みとマークしました",
    en: "The user marked the following documents as reviewed",
    id: "Pengguna menandai dokumen berikut sebagai ditinjau",
  } as const;
  const notesHeads = {
    ja: "備考",
    en: "Notes",
    id: "Catatan",
  } as const;
  const noneHeads = {
    ja: "確認済みの書類: なし",
    en: "Reviewed documents: none",
    id: "Dokumen yang ditinjau: tidak ada",
  } as const;

  const listPart = labels.length === 0 ? noneHeads[lang] : `${heads[lang]}: ${labels.join(", ")}`;
  const notesPart =
    state.notes.trim().length > 0 ? `\n${notesHeads[lang]}: ${state.notes.trim()}` : "";
  return `${listPart}${notesPart}`;
}

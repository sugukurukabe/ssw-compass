const SKELETON_ARIA_LABEL_BY_LANG = {
  ja: "必要書類を確認中",
  en: "Loading document checklist",
  id: "Memuat daftar dokumen",
} as const;

type SupportedLanguage = keyof typeof SKELETON_ARIA_LABEL_BY_LANG;

export function renderSkeleton(lang: SupportedLanguage): string {
  const label = SKELETON_ARIA_LABEL_BY_LANG[lang];
  const rows = [0, 1, 2, 3, 4, 5]
    .map(
      () => `
        <li class="doc-row skeleton" aria-hidden="true">
          <div class="skel-line skel-line--title"></div>
          <div class="skel-line skel-line--body"></div>
        </li>`,
    )
    .join("");
  return `<div class="skeleton-stack" role="status" aria-live="polite" aria-label="${label}">
    <ul class="doc-list">${rows}</ul>
  </div>`;
}

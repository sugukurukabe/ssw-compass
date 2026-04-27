const SKELETON_ARIA_LABEL_BY_LANG = {
  ja: "申請種別を判定中",
  en: "Classifying procedure",
  id: "Mengklasifikasikan prosedur",
} as const;

type SupportedLanguage = keyof typeof SKELETON_ARIA_LABEL_BY_LANG;

export function renderSkeleton(lang: SupportedLanguage): string {
  const label = SKELETON_ARIA_LABEL_BY_LANG[lang];
  return `<div class="skeleton-stack" role="status" aria-live="polite" aria-label="${label}">
    <article class="decision skeleton" aria-hidden="true">
      <div class="skel-line skel-line--title"></div>
      <div class="skel-line skel-line--body"></div>
      <div class="skel-line skel-line--body short"></div>
      <div class="skel-line skel-line--body"></div>
      <div class="skel-line skel-line--meta"></div>
    </article>
  </div>`;
}

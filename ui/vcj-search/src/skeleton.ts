const SKELETON_ARIA_LABEL_BY_LANG = {
  ja: "公式情報源を確認中",
  en: "Checking official sources",
  id: "Memeriksa sumber resmi",
} as const;

type SupportedLanguage = keyof typeof SKELETON_ARIA_LABEL_BY_LANG;

export function renderSkeleton(lang: SupportedLanguage): string {
  const label = SKELETON_ARIA_LABEL_BY_LANG[lang];
  const cards = [0, 1, 2]
    .map(
      () => `
        <article class="card skeleton" aria-hidden="true">
          <div class="skel-line skel-line--title"></div>
          <div class="skel-line skel-line--body"></div>
          <div class="skel-line skel-line--body short"></div>
          <div class="skel-line skel-line--meta"></div>
        </article>`,
    )
    .join("");
  return `<div class="skeleton-stack" role="status" aria-live="polite" aria-label="${label}">${cards}</div>`;
}

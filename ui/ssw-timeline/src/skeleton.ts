const SKELETON_ARIA_LABEL_BY_LANG = {
  ja: "期限タイムラインを確認中",
  en: "Checking deadline timeline",
  id: "Memeriksa linimasa tenggat waktu",
} as const;

type SupportedLanguage = keyof typeof SKELETON_ARIA_LABEL_BY_LANG;

export function renderSkeleton(lang: SupportedLanguage): string {
  const label = SKELETON_ARIA_LABEL_BY_LANG[lang];
  const rows = [0, 1, 2, 3]
    .map(
      () => `
        <li class="deadline skeleton" aria-hidden="true">
          <div class="skel-line skel-line--title"></div>
          <div class="skel-line skel-line--body"></div>
          <div class="skel-line skel-line--body short"></div>
        </li>`,
    )
    .join("");
  return `<div class="skeleton-stack" role="status" aria-live="polite" aria-label="${label}">
    <ul class="timeline">${rows}</ul>
  </div>`;
}

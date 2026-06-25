/**
 * ウィジェット内の言語切替 (ja/en/id) UI。
 * In-widget content language toggle (ja/en/id).
 * Pengalih bahasa konten di dalam widget (ja/en/id).
 *
 * 既定はホスト locale。利用者がホスト言語と異なる言語で読みたい場合に
 * ウィジェット側で上書きできるようにする (例: 日本語ホストの英語話者担当)。
 * The default follows the host locale; this lets a user override it locally
 * (e.g. an English speaker working inside a Japanese-locale host).
 *
 * UI コンテンツ辞書は現状 ja/en/id の 3 言語 (UI_LANGUAGES)。エラー通知は
 * 別途 10 言語対応 (renderLocalizedErrorNotice)。本トグルはコンテンツ言語用。
 */

import type { UILanguage } from "@ssw/shared-types";
import { escapeAttr } from "./escape.js";

const LANG_LABEL: Record<UILanguage, string> = {
  ja: "日本語",
  en: "English",
  id: "Bahasa",
};

const ARIA_LABEL: Record<UILanguage, string> = {
  ja: "表示言語",
  en: "Display language",
  id: "Bahasa tampilan",
};

/**
 * 言語切替セグメントの HTML 文字列を返す (DOMPurify を通しても安全な静的マークアップ)。
 * Returns the language toggle markup (static, safe to pass through DOMPurify).
 * Mengembalikan markup pengalih bahasa (statis, aman untuk DOMPurify).
 */
export function renderLanguageToggle(current: UILanguage): string {
  const buttons = (Object.keys(LANG_LABEL) as UILanguage[])
    .map((lang) => {
      const active = lang === current;
      return `<button type="button" class="ssw-lang-btn${active ? " ssw-lang-btn--active" : ""}" data-ssw-lang="${escapeAttr(lang)}" aria-pressed="${active ? "true" : "false"}">${escapeAttr(LANG_LABEL[lang])}</button>`;
    })
    .join("");
  return `<div class="ssw-lang-toggle" role="group" aria-label="${escapeAttr(ARIA_LABEL[current])}">${buttons}</div>`;
}

/**
 * 言語切替ボタンに click ハンドラを取り付ける。render 後に毎回呼ぶ。
 * Wires click handlers onto the language toggle buttons. Call after each render.
 * Memasang handler klik pada tombol pengalih bahasa. Panggil setelah render.
 */
export function wireLanguageToggle(
  rootEl: HTMLElement,
  onChange: (lang: UILanguage) => void,
): void {
  for (const button of Array.from(rootEl.querySelectorAll<HTMLButtonElement>("[data-ssw-lang]"))) {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-ssw-lang");
      if (value === "ja" || value === "en" || value === "id") {
        onChange(value);
      }
    });
  }
}

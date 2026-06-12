/**
 * UI Resource 共通のエラー表示
 * Shared error rendering for UI Resources
 * Render error bersama untuk UI Resource
 */

import {
  type ErrorDictionaryKey,
  getErrorMessage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@ssw/shared-types";
import { setInnerHTML } from "./trusted-html.js";

function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return input.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

export function pickSupportedLanguage(
  language: string | undefined,
  navigatorLanguage: string | undefined,
): SupportedLanguage {
  const candidates = [language, navigatorLanguage].filter((value): value is string => {
    return value !== undefined && value.length > 0;
  });
  for (const candidate of candidates) {
    const exact = SUPPORTED_LANGUAGES.find((supported) => supported === candidate);
    if (exact !== undefined) {
      return exact;
    }
    const prefix = SUPPORTED_LANGUAGES.find((supported) => candidate.startsWith(supported));
    if (prefix !== undefined) {
      return prefix;
    }
  }
  return "en";
}

export function renderLocalizedErrorNotice(input: {
  rootEl: HTMLElement;
  language: SupportedLanguage;
  kind: ErrorDictionaryKey;
  detail?: string | undefined;
  onRetry?: () => void;
}): void {
  const message = getErrorMessage(input.language, input.kind);
  const retryLabel = getErrorMessage(input.language, "error.retry_hint");
  const detail = input.detail === undefined ? "" : `<p>${escapeHtml(input.detail)}</p>`;
  const retry =
    input.onRetry === undefined
      ? ""
      : `<button type="button" id="ssw-error-retry">${escapeHtml(retryLabel)}</button>`;
  setInnerHTML(
    input.rootEl,
    `<section role="alert" aria-live="polite" class="ssw-error">
      <p>${escapeHtml(message)}</p>
      ${detail}
      ${retry}
    </section>`,
  );
  input.rootEl.querySelector("#ssw-error-retry")?.addEventListener("click", () => {
    input.onRetry?.();
  });
}

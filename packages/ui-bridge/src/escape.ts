/**
 * HTML エスケープ (全 UI Resource 共通)。
 * Shared HTML escaping for every UI Resource.
 * Escape HTML bersama untuk setiap UI Resource.
 *
 * 以前は各 widget の render.ts が同一の escapeHtml/escapeAttr を重複定義していた。
 * Previously each widget's render.ts duplicated the same escapeHtml/escapeAttr.
 * Sebelumnya tiap render.ts widget menduplikasi escapeHtml/escapeAttr yang sama.
 *
 * テキストノードと属性値で同じ 5 文字をエスケープすれば XSS は防げるため、
 * escapeHtml と escapeAttr は同じ実装を共有する (名前は呼び出し側の意図用)。
 */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * テキストノード向けエスケープ。
 * Escapes a string for safe use as HTML text content.
 * Escape string untuk konten teks HTML yang aman.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * 属性値向けエスケープ (escapeHtml と同じ 5 文字を処理)。
 * Escapes a string for safe use inside a double-quoted HTML attribute.
 * Escape string untuk atribut HTML berkutip ganda.
 */
export const escapeAttr = escapeHtml;

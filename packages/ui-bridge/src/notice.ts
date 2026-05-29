/**
 * structuredContent を持たない tool 結果 (空結果・エラー) 向けの簡易通知描画。
 * Simple notice rendering for tool results without structuredContent (empty/error).
 * Render notifikasi sederhana untuk hasil alat tanpa structuredContent (kosong/error).
 *
 * これがないと、isError や空結果のときに widget が skeleton のまま固まる。
 * Without this, the widget would otherwise stay stuck on the loading skeleton.
 * Tanpa ini, widget akan macet pada skeleton pemuatan.
 */

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

/**
 * tool 結果の text content を連結して返す (structuredContent が無い場合の本文取得)。
 * Joins the text content blocks of a tool result.
 * Menggabungkan blok konten teks dari hasil alat.
 */
export function extractToolResultText(params: unknown): string | undefined {
  const content = (params as { content?: unknown } | null | undefined)?.content;
  if (!Array.isArray(content)) return undefined;
  const parts = content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/**
 * 簡易通知を root 要素に描画する (改行は <br> に変換、本文はエスケープ済み)。
 * Renders a simple, escaped notice into the root element.
 * Render notifikasi sederhana yang sudah di-escape ke elemen root.
 *
 * 厳格 CSP 下でも安全なように inline style は使わず class のみを付与する。
 */
export function renderNotice(rootEl: HTMLElement, message: string): void {
  const safe = escapeHtml(message).replace(/\r?\n/g, "<br>");
  setInnerHTML(rootEl, `<p role="note" class="ssw-notice">${safe}</p>`);
}

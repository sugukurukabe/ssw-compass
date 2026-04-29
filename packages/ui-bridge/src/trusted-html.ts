/**
 * Trusted Types 対応の innerHTML セッター。
 * Trusted Types-compatible innerHTML setter.
 * Penyetel innerHTML yang kompatibel dengan Trusted Types.
 *
 * Claude などの MCP Apps ホストは widget iframe に
 * `require-trusted-types-for 'script'` を課すため、プレーン string を
 * `element.innerHTML` に代入すると TrustedHTML エラーで拒否される。
 *
 * この helper は一度だけ Trusted Types policy を作成し、以後は
 * `setInnerHTML(el, html)` で Policy 経由の安全な代入にする。
 * Policy が使えない環境 (旧ブラウザ、host CSP が緩い場合) では
 * フォールバックで plain 代入する。
 *
 * DOMPurify 等によるサニタイズは呼び出し側の責任。ここは「代入の手段」を
 * Trusted Types に揃えるだけ。
 */

type TrustedTypePolicy = {
  createHTML: (s: string) => string;
};

type TrustedTypesApi = {
  createPolicy: (name: string, rules: { createHTML: (s: string) => string }) => TrustedTypePolicy;
};

let cachedPolicy: TrustedTypePolicy | null | undefined = undefined;

function getPolicy(): TrustedTypePolicy | null {
  if (cachedPolicy !== undefined) return cachedPolicy;
  const win = window as unknown as { trustedTypes?: TrustedTypesApi };
  const api = win.trustedTypes;
  if (api === undefined) {
    cachedPolicy = null;
    return null;
  }
  try {
    cachedPolicy = api.createPolicy("ssw-compass", {
      createHTML: (input: string) => input,
    });
    return cachedPolicy;
  } catch {
    cachedPolicy = null;
    return null;
  }
}

/**
 * `el.innerHTML = html` を Trusted Types policy 経由で行う。
 * Assign innerHTML via Trusted Types policy when available.
 * Setel innerHTML melalui kebijakan Trusted Types bila tersedia.
 *
 * 呼び出し側は html が信頼できる (静的文字列 or DOMPurify 済み) ことを保証する。
 */
export function setInnerHTML(el: HTMLElement, html: string): void {
  const policy = getPolicy();
  if (policy !== null) {
    // TrustedHTML は innerHTML にそのまま代入可能 (browser 仕様)
    (el as unknown as { innerHTML: string }).innerHTML = policy.createHTML(html);
    return;
  }
  el.innerHTML = html;
}

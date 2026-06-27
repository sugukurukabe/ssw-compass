/**
 * UI ウィジェット resource の `_meta` (CSP) を組み立てる共通ヘルパ (T12)。
 * Shared helper that builds the UI widget resource `_meta` (CSP) (T12).
 * Helper bersama untuk menyusun `_meta` (CSP) resource widget UI (T12).
 *
 * デュアル宣言の方針 / Dual-host declaration / Deklarasi dua-host:
 * - `_meta.ui.csp` (nested) は MCP/Anthropic ext-apps と OpenAI Apps SDK の双方が読む
 *   接続/資源ドメインの正本。現状は外部接続なしのため全て空配列のまま踏襲する。
 *   `_meta.ui.csp` (nested) is the source of truth for connect/resource domains and is
 *   read by both the MCP/Anthropic ext-apps host and the OpenAI Apps SDK host. It stays
 *   all-empty because the widgets make no external connections today.
 *   `_meta.ui.csp` (nested) adalah sumber kebenaran domain connect/resource dan dibaca
 *   oleh host ext-apps MCP/Anthropic maupun OpenAI Apps SDK. Tetap kosong karena widget
 *   tidak melakukan koneksi eksternal saat ini.
 * - `_meta["openai/widgetCSP"]` (legacy flat key) は OpenAI が外部リンク
 *   (`window.openai.openExternal(...)`) の許可に使う `redirect_domains` の唯一の宣言先。
 *   外部 Pro 誘導ドメイン (Phase 2a) のみを宣言する。connect/resource も冗長併記して
 *   両ホスト対応を担保する (未対応キーはホストが無視するため安全)。
 *   `_meta["openai/widgetCSP"]` (legacy flat key) is the ONLY place OpenAI reads
 *   `redirect_domains` for external `openExternal(...)` links. It declares only the
 *   external Pro origin (Phase 2a). connect/resource are mirrored redundantly for
 *   dual-host coverage (unknown keys are ignored by each host, so this is safe).
 *
 * 境界 / Boundaries / Batas:
 * - 許可ドメインは実態に必要なもののみ (現状の ui.csp 宣言を踏襲 = connect/resource は空)。
 * - 外部 Pro ドメインは `proRedirectDomains()` (許可外部 origin のみ) から取得する。
 * - ChatGPT 内に決済 UI を出さない。redirect は Phase 2a の非モーダル外部誘導のみ。
 */

import { proRedirectDomains } from "../auth/upgrade-notice.js";

/**
 * MCP/Anthropic ext-apps と OpenAI の双方が読む nested CSP。
 * Nested CSP read by both the MCP/Anthropic ext-apps and OpenAI hosts.
 * CSP nested yang dibaca oleh host ext-apps MCP/Anthropic dan OpenAI.
 */
export type UiCspMeta = {
  connectDomains: string[];
  resourceDomains: string[];
  frameDomains: string[];
  baseUriDomains: string[];
};

/**
 * OpenAI Apps SDK 用の widget CSP (flat key)。`redirect_domains` が正本。
 * The OpenAI Apps SDK widget CSP (flat key); `redirect_domains` is authoritative.
 * CSP widget OpenAI Apps SDK (flat key); `redirect_domains` adalah yang berwenang.
 */
export type OpenAiWidgetCspMeta = {
  connect_domains: string[];
  resource_domains: string[];
  redirect_domains: string[];
};

/**
 * UI resource の `_meta` 全体 (ui.csp + openai/widgetCSP の併記)。
 * The full UI resource `_meta` (co-declaring ui.csp + openai/widgetCSP).
 * `_meta` resource UI lengkap (mendeklarasikan ui.csp + openai/widgetCSP bersama).
 */
export type WidgetResourceMeta = {
  ui: { prefersBorder: boolean; csp: UiCspMeta };
  "openai/widgetCSP": OpenAiWidgetCspMeta;
};

/**
 * nested `ui.csp` を返す。現状は外部接続なし (全空配列)。
 * 一次情報・GCS 署名 URL はウィジェットからは fetch せず、ホストのリンク遷移
 * (DOMPurify 許可リスト) で開くため connect/resource を増やさない。
 * Returns the nested `ui.csp`; currently no external connections (all empty). Primary
 * sources and GCS signed URLs are opened via host link navigation (DOMPurify allowlist),
 * not fetched by the widget, so connect/resource stay empty.
 * Mengembalikan `ui.csp` nested; saat ini tanpa koneksi eksternal (semua kosong). Sumber
 * primer dan URL bertanda tangan GCS dibuka via navigasi tautan host (allowlist DOMPurify),
 * bukan di-fetch widget, sehingga connect/resource tetap kosong.
 */
function buildUiCsp(): UiCspMeta {
  return {
    connectDomains: [],
    resourceDomains: [],
    frameDomains: [],
    baseUriDomains: [],
  };
}

/**
 * OpenAI 用 widget CSP を組み立てる。connect/resource は ui.csp と整合 (空)、
 * redirect_domains には外部 Pro 誘導 origin のみを宣言する。
 * Builds the OpenAI widget CSP: connect/resource mirror ui.csp (empty), while
 * redirect_domains declares only the external Pro origin.
 * Menyusun CSP widget OpenAI: connect/resource mengikuti ui.csp (kosong), sedangkan
 * redirect_domains hanya mendeklarasikan origin Pro eksternal.
 */
export function buildOpenAiWidgetCsp(): OpenAiWidgetCspMeta {
  const ui = buildUiCsp();
  return {
    connect_domains: [...ui.connectDomains],
    resource_domains: [...ui.resourceDomains],
    redirect_domains: proRedirectDomains(),
  };
}

/**
 * UI resource の `_meta` を組み立てる (ui.csp + openai/widgetCSP)。
 * Builds the UI resource `_meta` (ui.csp + openai/widgetCSP).
 * Menyusun `_meta` resource UI (ui.csp + openai/widgetCSP).
 */
export function buildWidgetResourceMeta(): WidgetResourceMeta {
  return {
    ui: {
      prefersBorder: true,
      csp: buildUiCsp(),
    },
    "openai/widgetCSP": buildOpenAiWidgetCsp(),
  };
}

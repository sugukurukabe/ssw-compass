import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { SearchVisaOutput, SupportedLanguage, UILanguage } from "@ssw/shared-types";
import {
  extractToolResultText,
  getElement,
  pickSupportedLanguage,
  renderLocalizedErrorNotice,
  setInnerHTML,
} from "@ssw/ui-bridge";
import { render } from "./render.js";
import { renderSkeleton } from "./skeleton.js";

type HostContextChangedParams = {
  theme?: Parameters<typeof applyDocumentTheme>[0];
  locale?: string;
};

function pickLanguage(locale: string | undefined): UILanguage {
  if (locale === undefined) return "en";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("id")) return "id";
  return "en";
}

let currentLang: UILanguage = "ja";
let currentErrorLang: SupportedLanguage = "ja";
let currentResult: SearchVisaOutput | null = null;
let showSources = false;
// 利用者がウィジェット内で言語を選んだら、以後ホスト locale で上書きしない。
let langOverridden = false;

const root = getElement("root", HTMLDivElement);

// connect() 完了を待たず即 skeleton を描画する。これにより iframe が最低限の
// 高さを持つので、ResizeObserver (ext-apps autoResize) が iframe 高さを
// 0/32px から skeleton の実寸まで伸ばせる。
setInnerHTML(root, renderSkeleton(currentLang));

const app = new App({ name: "SSW", version: "1.0.0" }, {});

// ホストが注入する動的 <style> (applyHostFonts) と documentElement への
// style.setProperty (applyHostStyleVariables) は、Claude Web が課す strict CSP
// で拒否されるためスキップする。applyDocumentTheme は data-theme 属性を
// 付けるだけなので安全。
app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) {
    applyDocumentTheme(params.theme);
  }
  if (!langOverridden) {
    currentLang = pickLanguage(params.locale);
  }
  currentErrorLang = pickSupportedLanguage(params.locale, navigator.language);
};

app.ontoolinput = () => {
  setInnerHTML(root, renderSkeleton(currentLang));
};

app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) {
    renderLocalizedErrorNotice({
      rootEl: root,
      language: currentErrorLang,
      kind: "error.communication_failed",
      detail: extractToolResultText(params),
      onRetry: () => {
        (app as unknown as { updateModelContext?: (ctx: unknown) => void }).updateModelContext?.({
          error_kind: "communication_failed",
          tool: "search_visa",
          retriable: true,
        });
      },
    });
    return;
  }
  currentResult = structured as SearchVisaOutput;
  showSources = false;
  rerender();
};

function rerender(): void {
  if (currentResult === null) return;
  render(currentResult, currentLang, root, showSources, {
    onToggleSources: () => {
      showSources = !showSources;
      rerender();
    },
    onLangChange: (lang) => {
      langOverridden = true;
      currentLang = lang;
      rerender();
    },
  });
}

await app.connect(new PostMessageTransport(window.parent, window.parent));

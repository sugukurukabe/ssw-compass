import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { SearchVisaOutput, UILanguage } from "@ssw/shared-types";
import { getElement, setInnerHTML } from "@ssw/ui-bridge";
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
  currentLang = pickLanguage(params.locale);
};

app.ontoolinput = () => {
  setInnerHTML(root, renderSkeleton(currentLang));
};

app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) {
    return;
  }
  render(structured as SearchVisaOutput, currentLang, root);
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

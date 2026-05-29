import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { GetDeadlineTimelineOutput, UILanguage } from "@ssw/shared-types";
import { extractToolResultText, getElement, renderNotice, setInnerHTML } from "@ssw/ui-bridge";
import { render } from "./render.js";
import { renderSkeleton } from "./skeleton.js";

// structuredContent が無い (空結果・エラー) tool 結果向けのフォールバック文言。
const NOTICE_FALLBACK: Record<UILanguage, string> = {
  ja: "結果を表示できませんでした。もう一度お試しください。",
  en: "Could not display a result. Please try again.",
  id: "Tidak dapat menampilkan hasil. Silakan coba lagi.",
};

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

setInnerHTML(root, renderSkeleton(currentLang));

const app = new App({ name: "SSW", version: "1.0.0" }, {});

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
    // 空結果・エラー時は skeleton のままにせず、返却テキストを通知として表示する。
    renderNotice(root, extractToolResultText(params) ?? NOTICE_FALLBACK[currentLang]);
    return;
  }
  render(structured as GetDeadlineTimelineOutput, currentLang, root);
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

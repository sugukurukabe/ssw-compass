import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { GetDeadlineTimelineOutput, SupportedLanguage, UILanguage } from "@ssw/shared-types";
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
let langOverridden = false;
let currentResult: GetDeadlineTimelineOutput | null = null;

const root = getElement("root", HTMLDivElement);

setInnerHTML(root, renderSkeleton(currentLang));

const app = new App({ name: "SSW", version: "1.0.0" }, {});

function rerender(): void {
  if (currentResult === null) return;
  render(currentResult, currentLang, root, {
    onLangChange: (lang) => {
      langOverridden = true;
      currentLang = lang;
      rerender();
    },
  });
}

app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) {
    applyDocumentTheme(params.theme);
  }
  if (!langOverridden) {
    currentLang = pickLanguage(params.locale);
  }
  currentErrorLang = pickSupportedLanguage(params.locale, navigator.language);
  if (currentResult !== null) rerender();
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
          tool: "get_deadline_timeline",
          retriable: true,
        });
      },
    });
    return;
  }
  currentResult = structured as GetDeadlineTimelineOutput;
  rerender();
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

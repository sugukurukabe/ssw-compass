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

const root = getElement("root", HTMLDivElement);

setInnerHTML(root, renderSkeleton(currentLang));

const app = new App({ name: "SSW", version: "1.0.0" }, {});

app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) {
    applyDocumentTheme(params.theme);
  }
  currentLang = pickLanguage(params.locale);
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
          tool: "get_deadline_timeline",
          retriable: true,
        });
      },
    });
    return;
  }
  render(structured as GetDeadlineTimelineOutput, currentLang, root);
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

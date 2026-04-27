import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps";
import type { SearchVisaOutput, SupportedLanguage } from "@ssw/shared-types";
import { getElement } from "@ssw/ui-bridge";
import { render } from "./render.js";
import { renderSkeleton } from "./skeleton.js";

type HostContextChangedParams = {
  theme?: Parameters<typeof applyDocumentTheme>[0];
  locale?: string;
  styles?: {
    variables?: Parameters<typeof applyHostStyleVariables>[0];
    css?: { fonts?: Parameters<typeof applyHostFonts>[0] };
  };
};

function pickLanguage(locale: string | undefined): SupportedLanguage {
  if (locale === undefined) return "en";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("id")) return "id";
  return "en";
}

let currentLang: SupportedLanguage = "ja";

const root = getElement("root", HTMLDivElement);

const app = new App({ name: "SSW", version: "1.0.0" }, {});

app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) {
    applyDocumentTheme(params.theme);
  }
  if (params.styles?.variables !== undefined) {
    applyHostStyleVariables(params.styles.variables);
  }
  if (params.styles?.css?.fonts !== undefined) {
    applyHostFonts(params.styles.css.fonts);
  }
  currentLang = pickLanguage(params.locale);
};

app.ontoolinput = () => {
  root.innerHTML = renderSkeleton(currentLang);
};

app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) {
    return;
  }
  render(structured as SearchVisaOutput, currentLang, root);
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

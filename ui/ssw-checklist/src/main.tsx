import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps";
import type { ListVisaDocumentsOutput, SupportedLanguage } from "@ssw/shared-types";
import { getElement } from "@ssw/ui-bridge";
import { render } from "./render.js";
import { renderSkeleton } from "./skeleton.js";
import {
  buildCommitSummary,
  type ChecklistState,
  EMPTY_STATE,
  setNotes,
  toggleDocId,
} from "./state.js";

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
let current: ChecklistState = EMPTY_STATE;
let lastCommitted: ChecklistState | null = null;
let committedOnce = false;
let currentDocs: ListVisaDocumentsOutput | null = null;

const root = getElement("root", HTMLDivElement);

const app = new App({ name: "SSW", version: "1.0.0" }, {});

function rerender(): void {
  if (currentDocs === null) return;
  render(
    { result: currentDocs, state: current, lastCommitted, lang: currentLang, committedOnce },
    root,
    {
      onToggle: (id) => {
        current = toggleDocId(current, id);
        rerender();
      },
      onNotesChange: (v) => {
        current = setNotes(current, v);
        rerender();
      },
      onCommit: () => {
        if (currentDocs === null) return;
        const summary = buildCommitSummary(current, currentDocs, currentLang);
        void app.updateModelContext({
          content: [{ type: "text", text: summary }],
        });
        lastCommitted = current;
        committedOnce = true;
        rerender();
      },
    },
  );
}

app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) applyDocumentTheme(params.theme);
  if (params.styles?.variables !== undefined) applyHostStyleVariables(params.styles.variables);
  if (params.styles?.css?.fonts !== undefined) applyHostFonts(params.styles.css.fonts);
  currentLang = pickLanguage(params.locale);
  if (currentDocs !== null) rerender();
};

app.ontoolinput = () => {
  root.innerHTML = renderSkeleton(currentLang);
};

app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) return;
  currentDocs = structured as ListVisaDocumentsOutput;
  current = EMPTY_STATE;
  lastCommitted = null;
  committedOnce = false;
  rerender();
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { ListVisaDocumentsOutput, UILanguage } from "@ssw/shared-types";
import { extractToolResultText, getElement, renderNotice, setInnerHTML } from "@ssw/ui-bridge";
import { render } from "./render.js";
import { renderSkeleton } from "./skeleton.js";
import {
  buildCommitSummary,
  type ChecklistState,
  EMPTY_STATE,
  setNotes,
  toggleDocId,
} from "./state.js";

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
let current: ChecklistState = EMPTY_STATE;
let lastCommitted: ChecklistState | null = null;
let committedOnce = false;
let currentDocs: ListVisaDocumentsOutput | null = null;

const root = getElement("root", HTMLDivElement);

setInnerHTML(root, renderSkeleton(currentLang));

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
  currentLang = pickLanguage(params.locale);
  if (currentDocs !== null) rerender();
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
  currentDocs = structured as ListVisaDocumentsOutput;
  current = EMPTY_STATE;
  lastCommitted = null;
  committedOnce = false;
  rerender();
};

await app.connect(new PostMessageTransport(window.parent, window.parent));

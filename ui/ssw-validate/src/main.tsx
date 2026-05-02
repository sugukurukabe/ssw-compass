import { App, applyDocumentTheme, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { ValidateZairyuCompatibilityOutput } from "@ssw/shared-types";
import { getElement, setInnerHTML } from "@ssw/ui-bridge";
import DOMPurify from "dompurify";

type HostContextChangedParams = {
  theme?: Parameters<typeof applyDocumentTheme>[0];
};

const root = getElement("root", HTMLDivElement);

setInnerHTML(root, `<div class="panel"><h2>在留資格の適合性を確認中</h2></div>`);

const app = new App({ name: "SSW", version: "1.0.0" }, {});

app.onhostcontextchanged = (params: HostContextChangedParams) => {
  if (params.theme !== undefined) applyDocumentTheme(params.theme);
};

app.ontoolresult = (params) => {
  const structured = params.structuredContent;
  if (structured === undefined) return;
  render(structured as ValidateZairyuCompatibilityOutput);
};

function render(result: ValidateZairyuCompatibilityOutput): void {
  const issues = result.legal_basis.map((basis) => `<li>${escapeHtml(basis)}</li>`).join("");
  const html = `
    <article class="panel">
      <span class="badge ${escapeHtml(result.compatibility)}">${escapeHtml(result.compatibility)}</span>
      <h2>在留資格と業務の適合性</h2>
      <p>${escapeHtml(result.recommended_action)}</p>
      ${issues.length > 0 ? `<ul class="issues">${issues}</ul>` : ""}
      ${
        result.escalate_to_professional
          ? `<div class="cta">行政書士または弁護士による確認を推奨します。</div>`
          : `<div class="cta">在留期限の定期確認を続けてください。</div>`
      }
      <p class="disclaimer">${escapeHtml(result.disclaimer)}</p>
    </article>`;
  setInnerHTML(root, DOMPurify.sanitize(html));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

await app.connect(new PostMessageTransport(window.parent, window.parent));

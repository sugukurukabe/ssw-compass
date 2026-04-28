# ADR-020: PDF/CSV output gating — legal level assignment for list_visa_documents

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 9)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `apps/server/src/tools/list-visa-documents/handler.ts`,
  `packages/shared-types/src/tools/list-visa-documents-v4.ts`

---

## Context

v4 §3.3 introduces `output_format` to `list_visa_documents`:
- `json`: raw structured data (v3 default)
- `html_preview`: rendered HTML preview (Free OK)
- `pdf_draft`: PDF draft with watermark (Pro+ only)
- `csv`: machine-readable CSV for online application (Pro+ only)

The legal distinction is:
- `json` / `html_preview`: general template provision → **L1** (Free OK)
- `pdf_draft` / `csv`: individual document output that could be submitted
  directly or used as a base document → **L2** (行政書士認証下のみ)

This is a **per-call escalation** from the tool's static annotation `legalLevel: "L1"`
to an effective `legalLevel: "L2"` based on the `output_format` input.
This pattern is defined in ADR-014 §Per-call escalation.

---

## Decision

### 1. output_format determines effective legalLevel

| output_format | Static annotation | Effective level | Tier |
|---|---|---|---|
| `json` | L1 | L1 | Free |
| `html_preview` | L1 | L1 | Free |
| `pdf_draft` | L1 → escalates | **L2** | Pro + gyoseishoshi |
| `csv` | L1 → escalates | **L2** | Pro + gyoseishoshi |

### 2. effectiveLegalLevel() is a pure function of input

```typescript
export function effectiveLegalLevel(
  input: z.infer<typeof ListVisaDocumentsInputV4>,
): LegalLevel {
  return input.output_format === "pdf_draft" || input.output_format === "csv"
    ? "L2"
    : "L1";
}
```

This satisfies ADR-014 §Per-call escalation constraint: "escalation MUST
be inferrable from input schema alone — no network calls, no DB reads."

### 3. html_preview returns watermarked HTML

Free tier `html_preview` renders the document list as HTML with a watermark
footer indicating it is a draft/reference only. This serves as the conversion
funnel toward Pro tier.

The watermark text (Sprint 4):
```
【下書き・参考資料】本書類は行政書士による確認前の参考資料です。改正行政書士法§19により、
申請書類の作成代行は行政書士のみが行えます。Pro プランへのアップグレード後、
行政書士アカウントで実際の申請書類を生成してください。
```

### 4. watermark is injected server-side, not UI-side

The watermark is injected as a string field in the structured response
(`watermark` field). The UI is responsible for rendering it. Server-side
injection ensures the watermark cannot be stripped by UI manipulation.

---

## Alternatives rejected

### A. Allow pdf_draft for Free tier with watermark (no gating)

The risk is that a Free user extracts the PDF and submits it, bypassing
行政書士法 §19 requirements. Gating at L2 is structurally safer. Rejected.

### B. Gate html_preview at L2 as well

html_preview is a rendered preview, not a submittable document. Gating it
would reduce the conversion funnel for Free users. Rejected.

### C. Implement PDF generation in Sprint 4

PDF generation requires an additional library (pdfkit / puppeteer). Sprint 4
defers actual PDF byte generation to Sprint 5. In Sprint 4, `pdf_draft`
returns a `pdf_draft_available: true` flag and the watermarked HTML payload.
Pro users can request the actual PDF in Sprint 5. This is clearly documented
in the response.

---

## Consequences

### `effectiveLegalLevel()` must be called in handler BEFORE auth check

```typescript
// ADR-014 §Per-call escalation reference
// ADR-020 §Decision §2
const runtimeLevel = effectiveLegalLevel(args);
assertHitlGateRuntime(auth, "list_visa_documents", "L1", runtimeLevel);
```

### Free html_preview response shape (Sprint 4)

```json
{
  "documents": [...],
  "output_format": "html_preview",
  "html_preview": "<ul>...</ul>",
  "watermark": "【下書き・参考資料】...",
  "disclaimer": "..."
}
```

### Sprint 5 follow-up

- Actual PDF byte generation using pdfkit/puppeteer
- CSV format output with official field mapping
- Business tier AI auto-fill (`output_format: "ai_autofill"`)

---

## Related

- ADR-014: per-call legalLevel escalation pattern
- ADR-013: AuthContext (used in assertHitlGateRuntime)
- v4 §3.3: list_visa_documents output_format specification

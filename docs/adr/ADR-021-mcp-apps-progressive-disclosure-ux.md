# ADR-021: MCP Apps progressive disclosure UX

## Status

Accepted

## Context

SSW Compass reached production deployment with working MCP Apps widgets, but
the first Claude Web verification exposed a product-quality issue: the UI was
technically interactive, yet it optimized for source display rather than the
user's real workflow.

Current problems:

- `search_visa` shows many source cards by default. Users asking "what do I
  need to do?" do not primarily need a list of URLs.
- `classify_procedure` is one-shot and does not guide the user through the
  procedure-defining facts.
- `list_visa_documents` shows a flat checklist. It does not model the
  Immigration Services Agency's 第1表 / 第2表 / 第3表 structure, receiving
  organization conditions, or applicant-specific branches.
- `get_deadline_timeline` duplicates source-card behavior instead of focusing
  on actionable deadlines.
- Some tools expose richer v4 schemas in handlers than in `tools/list`, so MCP
  hosts cannot reliably discover the intended parameters.

Anthropic's MCP Apps design guidelines require apps to feel native to
conversation:

- Inline cards should stay compact, preferably no more than 500px high.
- Apps should use progressive disclosure instead of deep navigation.
- Hidden menus and popovers should be avoided; visible chips, segmented
  buttons, toggles, or inline tabs are preferred.
- Source material should be available, but not dominate the default user
  experience.
- App interactions should handle direct manipulation; language understanding
  should be pushed back to the conversation.

The Immigration Services Agency's SSW application flow is naturally a guided
classifier:

1. Procedure type: 認定 / 変更 / 更新.
2. Receiving organization profile: 同一年度2人目以降, 第2表の1 eligible,
  法人, 個人事業主.
3. Applicant profile: 技能実習2号良好修了, 異分野, 技能実習1号のみ/なし,
  sector-specific exceptions.
4. Industry: 第3表 and sector-specific documents.

PDF/file delivery is deferred to Sprint 6. Sprint 5 may provide official
`moj.go.jp` links only.

## Decision

Adopt a classifier-first, progressive disclosure UX for all user-facing MCP
Apps.

### 1. `classify_procedure` becomes the primary workflow entry point

The widget guides users through four visible-chip questions:

1. Current situation:
   - overseas new entry -> 在留資格認定証明書交付申請
   - in Japan, changing from another status -> 在留資格変更許可申請
   - already SSW, extending -> 在留期間更新許可申請
2. Receiving organization profile, for 認定/変更 only:
   - same fiscal year, second or later SSW applicant -> 第2表不要
   - 第2表の1 eligible organization -> 第2表の1 + 参考様式第1-29号
   - corporation -> 第2表の2
   - sole proprietor -> 第2表の3
3. Applicant profile:
   - 技能実習2号良好修了, same field
   - 技能実習2号良好修了, different field
   - no eligible technical-intern exemption
   - sector-specific exception
4. Industry:
   - SSW(i): 16 industries
   - SSW(ii): 11 industries

At the end, `structuredContent` includes a `formBundle` summary:

```ts
type FormBundle = {
  procedure: "coe" | "change" | "renewal";
  sswLevel: "i" | "ii";
  receivingOrganizationProfile:
    | "same_fiscal_year_repeat"
    | "table2_1_eligible"
    | "corporation"
    | "sole_proprietor"
    | "not_applicable";
  applicantProfile:
    | "technical_intern_2_same_field"
    | "technical_intern_2_different_field"
    | "no_exemption"
    | "sector_exception";
  industry: string;
  requiredSections: Array<"table1" | "table2_1" | "table2_2" | "table2_3" | "table3">;
  omittedSections: string[];
  officialReferencePage: "https://www.moj.go.jp/isa/applications/status/specifiedskilledworker.html";
};
```

### 2. `list_visa_documents` consumes the classifier result

`list_visa_documents` remains usable standalone, but its best path is via
`classify_procedure`'s `formBundle`.

The checklist groups documents by purpose:

- 必須: 第1表 / 第3表 / common required documents
- 所属機関で変わる: 第2表の1/2/3 or omitted
- 申請人で変わる: technical-intern exemption, skills test, Japanese test
- 分野で変わる: agriculture, fishery, construction, etc.
- 省略可: visible, but separated from required items

The UI keeps a commit moment button that calls `app.updateModelContext()` with
a concise checklist summary for the conversation.

### 3. `search_visa` becomes a topic finder, not a source deck

Default view:

- 2-3 short answer paragraphs
- one "Sources" chip with count
- optional follow-up chips: 書類, 期限, 申請種別, 在留資格適合性

Source cards are collapsed by default and expanded only when the user asks or
clicks "Sources".

### 4. `get_deadline_timeline` focuses on deadlines

The UI should show:

- deadline cards or a compact timeline
- alert thresholds if provided
- no default source-card stack

### 5. Official links are allowed; file serving is deferred

Sprint 5 may open official `moj.go.jp` links through `ui/open-link`, and the
submission packet must declare:

```json
["https://www.moj.go.jp"]
```

Direct file download, GCS mirroring, generated PDFs, and CSV output remain
Sprint 6+ work.

### 6. Accessibility and host fit are acceptance criteria

Every widget must:

- work in light and dark mode
- keep tap targets at least 44px
- avoid hidden menus and popovers
- avoid nested scroll areas in inline mode
- maintain keyboard-focusable controls
- degrade to meaningful text if the host does not render MCP Apps

## Alternatives rejected

### A. Keep source-card UI and only improve ranking

Ranking fixes are necessary but not sufficient. The product problem is the
workflow model, not just retrieval quality.

### B. Add all documents to one very large checklist

This violates the inline-card guidance and forces users to parse legal
conditions themselves. It also increases the risk that users submit unnecessary
documents or miss omission conditions.

### C. Build file download now

Downloading or mirroring immigration forms introduces update, copyright, and
operational risk. Official-link guidance is enough for Sprint 5 submission and
keeps the app read-only.

### D. Model this as chat prompts only

The key user value is structured direct manipulation: selecting procedure,
organization, applicant, and industry chips. This is exactly where MCP Apps add
value over a plain text response.

## Consequences

- Anthropic submission moves from a source-card screenshot story to a workflow
  screenshot story.
- The primary demo becomes "answer four guided questions and receive the right
  第1表/第2表/第3表 checklist".
- Existing widgets require material rewrites, but the work aligns with MCP
  Apps guidelines and the product's real use case.
- Future Sprint 6 file downloads can attach cleanly to the `formBundle` and
  `forms-catalog` data model.


# ADR-004: React-free UI stack — pure TypeScript + DOM + @vcj/ui-bridge

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 1, Batch 4)
- **Deciders**: @kabe, VCJ core team
- **Scope**: all UI Resources under `ui/` in this repository
- **Supersedes**: `docs/specs/v2-comprehensive-design.md` §4.3's `@vitejs/plugin-react` inclusion (demoted to example only)

## Context

`docs/specs/v2-comprehensive-design.md` §4.3 shows an example Vite config
that includes `@vitejs/plugin-react`. That line is illustrative rather
than prescriptive — v2 never explicitly requires React in VCJ UIs. Three
constraints pushed us to evaluate the default:

1. **Bundle budget.** v2 §13.1 specifies a 512 KB per-UI bundle budget,
   CI-enforced. React + ReactDOM + `scheduler` adds roughly 35–45 KB
   gzipped (~120 KB minified) that must come out of the same budget.
2. **Content-Security-Policy hardening roadmap.** Sprint 3 flips the UI
   CSP from `'unsafe-inline'` to hash-based `script-src`. React's JSX
   runtime and internal utilities are compatible with `strict-dynamic`,
   but every additional piece of library code is another hash to
   compute and audit. Pure DOM is strictly fewer moving parts.
3. **Non-null-assertion ban.** VCJ code rules (`.cursor/rules/...`)
   forbid `!` non-null assertions. React's idiomatic
   `document.getElementById("root")!` pattern would need a wrapper
   anyway, so the cost of *not* using React is near zero in authoring
   ergonomics once that wrapper exists.

The `search_visa` UI is a **read-only rendering** of a
`CallToolResult.structuredContent` payload. The UI's entire dynamic
surface is:

- `currentLang: "ja" | "en" | "id"`
- `mode: "idle" | "loading" | "result"`
- A host-context-driven CSS variable / font / theme applier

There is no form, no routing, no client-side data fetching, no
multi-step state machine. React's cost–benefit here is negative:
framework overhead without the use cases that justify it.

Alternatives considered:

- **React**: rejected on bundle size + CSP surface; no gain for the
  current UI needs.
- **Preact**: 3 KB gzipped, JSX-compatible. Considered viable fallback
  if a future VCJ UI needs JSX ergonomics (virtualized lists, forms
  with controlled inputs). Kept as the stated migration path rather
  than adopted preemptively — YAGNI.
- **SolidJS**: fine-grained reactivity, no VDOM. Similar trade-offs to
  Preact; defer until needed.

## Decision

1. Build all Sprint 1 UIs (`ui/vcj-search/`) with **pure TypeScript +
   DOM API + DOMPurify**. No framework.
2. Introduce `packages/ui-bridge/` as a shared workspace package
   providing type-safe DOM helpers:
   - `getElement<T extends HTMLElement>(id, ctor): T`
   - `querySelector<T extends HTMLElement>(parent, selector, ctor): T`
   - `ElementNotFoundError`, `ElementTypeMismatchError`
   Every UI consumes these helpers; `document.getElementById(...)!` is
   banned across `ui/` (enforced by code review, to be upgraded to a
   lint rule in Sprint 3).
3. HTML construction goes through `DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP: /^https:\/\/(www\.)?(moj|mhlw|soumu|cao)\.go\.jp\// })`
   for every user-visible body.
4. **Sprint 2 UIs** (`vcj-checklist`, `vcj-deadline-timeline`) adopt the
   same stack. Re-evaluate if and only if one of them needs non-trivial
   interactive state (e.g. virtualized list, drag-and-drop).
5. `@vitejs/plugin-react` is **not** installed. v2 §4.3's inclusion is
   treated as illustrative example, not requirement.

## Consequences

Positive (measured on Sprint 1 output):

- `ui/vcj-search/dist/mcp-app.html` is **299,405 bytes (~292 KB)** —
  **58 % under** the 512 KB budget. Leaves room for future UIs (shared
  inline CSS, images, more content) without re-evaluating the stack.
- Zero `!` non-null assertions in `ui/vcj-search/src/**` — verified by
  grep at Sprint 1 close. `@vcj/ui-bridge.getElement<HTMLDivElement>("root", HTMLDivElement)`
  gives the same brevity as React's ref-by-id pattern while throwing
  a descriptive `ElementNotFoundError` / `ElementTypeMismatchError` on
  misuse.
- Fewer pieces to hash in the Sprint 3 CSP migration (only the app's
  own inline script + DOMPurify, no React runtime).
- Faster cold start: no framework bootstrap, HTML parses and hits the
  first render frame sooner.
- Consistent stack across Sprint 2 UI additions — one mental model for
  the whole `ui/` tree.

Negative / follow-up:

- Any future UI that genuinely benefits from a framework (virtualized
  lists, drag-and-drop, complex forms) requires revisiting this ADR.
  Candidate: **Preact** (smallest footprint + JSX parity). Document
  the decision in a fresh ADR and justify the cost.
- UI tests need to be written against jsdom + vitest for unit tests or
  Playwright for E2E; patterns TBD in Sprint 2/3. (Note: React's
  Testing Library would not have applied anyway for a read-only
  output, so this is not a regression.)
- Contributors familiar with React need a brief orientation on
  `@vcj/ui-bridge`. Addressed by the helper names being self-evident
  (`getElement`, `querySelector`) and by this ADR.

## Related

- `docs/specs/v2-comprehensive-design.md` §4.3 — example config (now
  errata)
- `docs/specs/v2-comprehensive-design.md` §13.1 — 512 KB per-UI budget
  (CI enforcement target)
- `docs/specs/v3-supplement.md` §20 — skeleton UX (stack-agnostic,
  compatible with this decision)
- `packages/ui-bridge/src/dom.ts` — the helpers introduced by this ADR

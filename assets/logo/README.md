# VCJ Logo Assets

## Current state — placeholder

`vcj-logo.svg` in this folder is a **placeholder** (simple depth-blue ring
+ "VCJ" wordmark, 56×56 viewBox). It is deliberately minimal so it never
ships to the Connectors Directory by accident — the `aria-label` contains
the string `"placeholder"` and CI / pre-submission review should grep for
that token.

## Required replacement before Sprint 4 submission

Per `docs/specs/v3-supplement.md` §A (brand section) the final logo must
satisfy:

- **Metaphor**: compass needle (羅針盤) + torii (鳥居), composed minimally.
- **Primary color**: depth blue `#0A2540` (the legal/public-service
  convention colour).
- **Format**: SVG monoline — single fill / stroke, no gradients, no bitmap
  imports. Must render cleanly as:
  - favicon (16×16 / 32×32 / Apple touch)
  - light-mode display
  - dark-mode display (invert or use host CSS variables — the logo should
    either be colour-independent or ship two explicit variants)
- **Accessibility**: `role="img"` with a descriptive `aria-label`
  (remove the `"(placeholder)"` suffix when the final asset lands).

## Replacement procedure

1. Drop the final SVG in place of `assets/logo/vcj-logo.svg`.
2. Remove the `(placeholder)` suffix from the `aria-label` — the live copy
   should simply say `"Visa Compass Japan"`.
3. Update `README.md` (this file) — remove the "Current state — placeholder"
   section and replace with the asset provenance (designer, date, license).
4. If dark-mode / alternate variants ship, add them as
   `vcj-logo-dark.svg`, `vcj-logo-monochrome.svg`, etc., and document each
   under a new "Variants" section below.
5. Reference the logo file(s) from:
   - Sprint 4 Directory submission packets (Anthropic + OpenAI)
   - `ui/*/mcp-app.html` header (optional, if a VCJ badge is rendered
     in UI chrome later)
   - `README.md` at the repo root (hero section)

## Out of scope for Sprint 2

The Sprint 2 kickoff prompt explicitly names VCJ logo as a deliverable and
equally explicitly says AI generation is **not** acceptable ("Do NOT
generate logos via AI; defer to human"). Sprint 2 ships the placeholder
only; the final monoline compass + torii design is produced by a human
designer before Sprint 4.

Tracked in `docs/sprint-3-pending.md` for the Sprint 3 / 4 follow-up
window.

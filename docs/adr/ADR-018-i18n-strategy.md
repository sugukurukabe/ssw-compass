# ADR-018: 10-language i18n strategy — phased Vertex rollout

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 8)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `packages/shared-types/src/i18n/`, `packages/shared-types/src/disclaimers.ts`,
  `apps/server/src/tools/search-visa/`, `apps/server/src/tools/get-deadline-timeline/`,
  `ui/*/src/`

---

## Context

v4 §3.1 requires `search_visa` to support 10 languages:
`ja`, `en`, `id`, `zh-CN`, `zh-TW`, `vi`, `tl`, `th`, `km`, `my`.

The challenge is that Vertex AI Search (`SSW_VERTEX_MODE=real`) grounds
responses in Japanese official documents. The quality of multilingual
retrieval has not been validated for languages other than ja/en/id.

Additionally, UI components currently have i18n dictionaries for ja/en/id
only. Expanding all 4 UI Resources to 10 languages in Sprint 4 would require
translations, testing, and WCAG accessibility review — significantly beyond
Batch 8 scope.

---

## Decision

### 1. Phased rollout: ja/en/id full, other 7 languages disclaimer-only in Sprint 4

| Tier | Languages | Sprint 4 support |
|---|---|---|
| Full | ja, en, id | Vertex grounding + all UI labels |
| Disclaimer-only | zh-CN, zh-TW, vi, tl, th, km, my | Disclaimer text provided; Vertex result quality unverified |

`VERTEX_GROUNDED_LANGUAGES = ["ja", "en", "id"]` — constant in
`packages/shared-types/src/i18n/supported-languages.ts`.

`isVertexGrounded(lang)` returns true only for these 3 languages.
Server logs `non_grounded_language_query` event for the other 7 to
enable Sprint 5 quality monitoring.

### 2. DISCLAIMER_BY_LANG expanded to 10 languages

All 10 disclaimers are provided in `packages/shared-types/src/disclaimers.ts`.
Non-ja/en/id are machine-translated + gyoseishoshi review is scheduled for
Sprint 5 Phase A (submission packet).

### 3. UI uses `UILanguage = "ja" | "en" | "id"` with `toUILanguage()` fallback

UI components (`ui/ssw-*/src/`) use `UILanguage` (3 languages) rather than
`SupportedLanguage` (10 languages). The `toUILanguage(lang)` function maps
unsupported languages to `"en"` fallback.

This means: when a user requests `language: "zh-CN"`, they receive:
- The disclaimer in Chinese (zh-CN from `DISCLAIMER_BY_LANG`)
- Vertex-retrieved content (best-effort, Japanese-focused index)
- UI labels in English (fallback via `toUILanguage`)

Sprint 5 expands `UILanguage` to 10 by adding UI dictionary entries and
validating each language's quality.

### 4. `SupportedLanguage` from `disclaimers.ts` is deprecated in favour of `i18n/supported-languages.ts`

The old `SupportedLanguage = keyof typeof DISCLAIMER_BY_LANG` from
`disclaimers.ts` is marked `@deprecated` and renamed to
`SupportedLanguageLegacy`. All new code uses `SupportedLanguage` from
`i18n/supported-languages.ts`.

---

## Consequences

### `packages/shared-types/src/i18n/supported-languages.ts`

```typescript
export const SUPPORTED_LANGUAGES = [
  "ja", "en", "id",
  "zh-CN", "zh-TW", "vi", "tl", "th", "km", "my",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const VERTEX_GROUNDED_LANGUAGES = ["ja", "en", "id"] as const;
export type VertexGroundedLanguage = (typeof VERTEX_GROUNDED_LANGUAGES)[number];
export function isVertexGrounded(lang: SupportedLanguage): lang is VertexGroundedLanguage;

export const UI_LANGUAGES = ["ja", "en", "id"] as const;
export type UILanguage = (typeof UI_LANGUAGES)[number];
export function toUILanguage(lang: SupportedLanguage): UILanguage;
```

### Vertex quality caveat

For `zh-CN` / `vi` / `km` / `my` users, retrieved content is drawn from
a Japanese-language data store. The relevance may be lower than for ja/en/id.
Users receive the content with the correct-language disclaimer.

Sprint 5 options:
1. Add translated source documents to the data stores (preferred)
2. Add per-language quality floor + empty-result handling in the handler
3. Gate non-grounded languages behind a Pro tier (least preferred)

### Sprint 5 upgrade path

1. Add ja/en/id translations for all 4 UI i18n dictionaries (human-translated)
2. Add Vertex ingestion of translated documents (Machine Translation + review)
3. Remove `UILanguage` distinction; `SupportedLanguage` becomes the UI type
4. Supersede this ADR with the full multilingual ADR

---

## Alternatives rejected

### A. Block non-grounded languages with an error

Rejecting `zh-CN` queries would break v4 §3.1 requirement. Rejected.

### B. Expand all 4 UI i18n dictionaries to 10 languages in Sprint 4

Would require ~70 new translated strings × 4 UIs = 280 strings, plus
human review for legal accuracy (disclaimer text). Out of scope for
a single batch. Rejected.

### C. Use a separate language service / translation API at runtime

Adds a new API dependency, latency, and cost. Overkill for Sprint 4.
Rejected.

---

## Related

- v4 §3.1: 10-language requirement
- sprint-4-plan §3.7: SUPPORTED_LANGUAGES / VERTEX_GROUNDED_LANGUAGES
- sprint-4-pending §3.5: CSP enforce (Sprint 4 Phase 3)

# Human Submission Checklist / 人間による提出チェックリスト

This repository contains the submission artifacts and verification steps. Final dashboard submission must be completed by an authenticated human account in each vendor portal.

## Shared Values

- App name: `SSW Compass Japan`
- Production MCP endpoint: `https://mcp.ssw-compass.jp/mcp`
- Server Card: `https://mcp.ssw-compass.jp/.well-known/mcp.json`
- OpenAI manifest: `https://mcp.ssw-compass.jp/.well-known/ai-plugin.json`
- OpenAPI document: `https://mcp.ssw-compass.jp/.well-known/openapi.json`
- Privacy policy: `https://mcp.ssw-compass.jp/privacy`
- Pro information page: `https://ssw-compass.jp/pro` (also served from `https://mcp.ssw-compass.jp/pro`)
- Support email: `a_kabe@sugu-kuru.co.jp`
- License: Apache-2.0
- Logo: `assets/logo/ssw-compass-icon-512.png`
- Screenshots: the 5 PNG files listed in `docs/screenshots/manifest.json` (all 1200px wide)

## Positioning Text

Use this short description where the form asks for an app summary:

`SSW Compass provides official-source-grounded information for Japanese Specified Skilled Worker (特定技能) visa procedures. It offers six anonymous, read-only tools for search, procedure classification, deadlines, document checklists, law updates, and zairyu compatibility. Information only; not legal advice; no personal identifiers accepted.`

## Anthropic Connector Submission

1. Log in to the Anthropic connector submission dashboard with the owner account.
2. Enter the MCP endpoint and Server Card URL above.
3. Confirm that `auth.type` is `none` for anonymous read-only review.
4. Upload 3-5 PNG screenshots. Use all 5 files from `docs/screenshots/`.
5. If a demo video is required, record a 120-second-or-shorter walkthrough using the prompts in `docs/submission/example-prompts.md`.
6. Include `docs/submission/reviewer-instructions.md` as reviewer notes.
7. Submit only after the portal preview shows the six read-only tools and no Pro tools for anonymous access.

## OpenAI Apps Submission

1. Log in to the OpenAI Apps submission dashboard with the owner account.
2. Use the manifest and OpenAPI URLs above.
3. Confirm the manifest shows `auth.type: none`, `contact_email`, `legal_info_url`, and the 512px logo URL.
4. Upload screenshots from `docs/screenshots/`.
5. Add the reviewer notes from `docs/submission/reviewer-instructions.md`.
6. Submit only after the app preview can call the six anonymous read-only tools and renders widgets with CSP intact.

## Human-Only Remainder

The codebase cannot complete the final dashboard click-submit because portal credentials, current form state, and any required legal attestations are outside repository access. A human owner must perform those authenticated portal steps.

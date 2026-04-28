# Changelog

All notable changes to SSW Compass are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — Sprint 5

### Added
- Apache-2.0 license (`LICENSE`, `NOTICE` files)
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`
- `/privacy` endpoint (trilingual privacy policy, pending gyoseishoshi review)
- `/.well-known/ai-plugin.json` endpoint (OpenAI Apps SDK preparation)
- `fetchAuditEvents()` full implementation (`@google-cloud/logging`)
- `docs/gyoseishoshi-review-packet.md` — review materials for gyoseishoshi
- `docs/6-host-verification-sprint5.md` — 6-host test guide
- `docs/cloudflare-migration-runbook.md` — Cloudflare NS migration
- `docs/demo-script.md` — 60s demo script × ja/en/id
- `docs/connectors-directory-submission.md` — submission form metadata
- Dockerfile `HEALTHCHECK` instruction
- GitHub repo: description, 7 topics, homepage URL
- Logo assets: main logo, app icon (512/1024px), mono mark, lockup-sm
- Node.js actions upgrade: checkout@v5, auth@v3, setup-gcloud@v3
- README: CI/CD/license badges

### Fixed
- Cloud DLP: `ZAIRYU_CARD_NUMBER` removed from `blockingInfoTypes` (custom type clash)
- Cloud DLP: `infoType` camelCase in `customInfoTypes` (snake_case not recognized by SDK)
- `AuthedRequest` type alias replaces `declare module` augmentation (Docker build fix)
- `fetchAuditEvents` stub replaced with full `@google-cloud/logging` implementation
- `source-index.jsonl`: 10 dead URLs replaced with live alternatives (2026-04-29)
- `source-index.jsonl`: 5 new entries added (visa_faq × 2, visa_legal × 3)
- prod Cloud Run: `allow_unauthenticated=true` (LB + Cloud Armor protect, JWT handles tiers)

---

## [4.0.0] — 2026-04-29 (Sprint 4 complete)

### Added
- **7 tools** (Sprint 4 v4): `list_law_updates`, `submit_gyoseishoshi_approval`,
  `validate_zairyu_compatibility` (+ 4 existing v3 tools)
- **HITL 12 controls** (ADR-014): H01 lockgate, H04 audit log, H06 illegal-work alert, H07 PII
- **Auth** (ADR-013): JWT bearer token, Free/Pro/Business tiers, `SSW_AUTH_MODE=jwt`
- **Audit log** (ADR-015): GCS bucket_lock 7-year WORM (`ssw-compass-audit-7y`)
- **10 languages** (ADR-018): ja/en/id full + zh-CN/TW/vi/tl/th/km/my disclaimer
- **Law updates fixture** (Batch 7): 6 entries, D1/D2 施行日確認済み
- **DLP tuning** (ADR-011): `minLikelihood=LIKELY`, removed EMAIL/PHONE/IBAN
- **prod deployment**: Global HTTPS LB + Cloud Armor + `mcp.ssw-compass.jp`
- **CSP enforce mode** (from Report-Only)
- `case_id` nanoid base36 (ADR-014)
- `assertDispatchAllowed` 2-industry restriction (ADR-017)
- PDF/CSV output gating L1→L2 escalation (ADR-020)
- `SswCompassToolAnnotation` v4 extension (legalLevel, tier, hitlControls)

### Changed
- `server-card.ts`: version `1.0.0` → `4.0.0`, auth `none` → `bearer`
- `publisher.url`: `sugu-kuru.co.jp` → `mcp.ssw-compass.jp`
- `DISCLAIMER_BY_LANG`: ja/en/id → 10 languages
- Cloud Run prod: `allow_unauthenticated=false` → `true` (LB-gated)

### Infrastructure
- Global HTTPS LB + serverless NEG (`modules/lb-https`)
- Cloud Armor WAF `ssw-waf-policy-prod` (Standard edition)
- VPC `ssw-vpc-prod` + NAT egress
- GCS audit bucket `ssw-compass-audit-7y` (is_locked=true)
- `ssw-jwt-secret` in Secret Manager
- Node.js actions upgrade to v5/v3

---

## [3.0.0] — 2026-04-28 (Sprint 3 complete)

### Added
- Terraform foundation (ADR-009): 9 modules, staging/prod envs, WIF, GCS state
- Cloud Run staging IAM-gated deploy with VPC egress pinned (136.110.117.132)
- GitHub Actions CI/CD with WIF (no long-lived keys)
- Cloud DLP 2nd-stage PII guard (ADR-011 reserved)
- Output sanitizer (Sprint 3 Batch 5)
- Hash-based CSP + Trusted Types (Report-Only)
- `safeFetch` URL allowlist (`apps/server/src/safety/url-guard.ts`)
- `process.env` index-access convention (ADR-008)
- Branch protection: PR + status checks required

---

## [2.0.0] — 2026-04-27 (Sprint 2 complete)

### Added
- 4 tools fully implemented: `search_visa`, `classify_procedure`,
  `get_deadline_timeline`, `list_visa_documents`
- 4 UI Resources (Vite + single-file HTML + DOMPurify + Trusted Types)
- Vertex AI Search DI seam (`SSW_VERTEX_MODE` env, ADR-006)
- PII guard skeleton (regex stage)
- Brand rename: SuguVisa Public → Visa Compass Japan → **SSW Compass** (ADR-007)
- Vitest in-memory transport test suite (~50 tests)

---

## [1.0.0] — 2026-04-26 (Sprint 1 complete)

### Added
- Monorepo scaffold (pnpm workspaces + Turborepo + Biome v2.4)
- `@modelcontextprotocol/sdk ^1.29` + `@modelcontextprotocol/ext-apps ^1.6`
- ADR-001 (pino v10) through ADR-005 (ext-apps evaluation)
- Design spec v2 (Comprehensive Research) + v3 supplement
- `SPEC-INDEX.md` + `docs/adr/` structure
- 4 tool skeletons (interfaces defined)
- Server Card `/.well-known/mcp.json`

# Contributing to SSW Compass

Thank you for your interest in contributing to SSW Compass.

## 言語 / Language / Bahasa

- Code comments, docs, and README: Japanese / English / Bahasa Indonesia (3-language rule)
- Commit messages: Japanese OK
- Issues & PRs: Japanese or English

## 開発環境 / Setup

```bash
git clone https://github.com/sugukurukabe/ssw-compass.git
cd ssw-compass
pnpm install
pnpm run typecheck   # 9 packages
pnpm -F @ssw/server test  # 232 tests
```

## ブランチ戦略 / Branching

- `main` — protected. PR + CI (2 checks) required.
- Feature: `feat/<area>-<description>`
- Hotfix: `hotfix/<description>`
- Docs: `docs/<description>`

## コード規約 / Code Standards

- TypeScript strict mode (`noUncheckedIndexedAccess: true`)
- Biome for lint/format (`pnpm exec biome check apps packages ui scripts`)
- No `any` — use `unknown` + type narrowing
- `process.env["KEY"]` index-access (ADR-008)
- Comments in 3 languages for public APIs

## セキュリティ / Security

- PII handling changes require ADR (`.cursor/rules/security.mdc`)
- BLOCKING_TYPES changes require ADR
- Do not add `unsafe-eval` to any CSP
- Do not bypass `scrubInputForPII` or output sanitizer

## 法令 / Legal Compliance

- All responses must include `DISCLAIMER_BY_LANG[language]`
- L2/L3 tools require `assertHitlGate` (ADR-014)
- No L4 tools (永久禁止)
- Primary sources only (*.go.jp, official ministry sites)

## PR チェックリスト / PR Checklist

- [ ] `pnpm run typecheck` passes (9/9)
- [ ] `pnpm -F @ssw/server test` passes
- [ ] `pnpm exec biome check apps packages ui scripts` 0 warnings
- [ ] `terraform fmt -check -recursive infra/terraform/` clean (if TF changes)
- [ ] Disclaimer not removed or weakened
- [ ] No PII in test fixtures

## 法的免責 / Legal

All contributions are licensed under Apache-2.0.
By contributing, you agree that your contributions will be licensed under
the Apache License, Version 2.0.

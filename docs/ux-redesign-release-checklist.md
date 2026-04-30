# UX Redesign Release Checklist

> Applies to the Sprint 5 MCP Apps progressive disclosure redesign.

## Before PR

- [ ] `pnpm -F @ssw/server test`
- [ ] `pnpm run typecheck`
- [ ] `pnpm exec biome check apps packages ui data scripts package.json docs/screenshots/manifest.json`
- [ ] `pnpm check:submission`
- [ ] Confirm no debug instrumentation remains:

```bash
rg "debugLog|127\\.0\\.0\\.1:7333|ee6c32|agent log"
```

Expected: no matches.

## After Staging Deploy

Run the MCP protocol smoke test:

```bash
MCP_URL="<staging-or-prod-mcp-url>/mcp" pnpm smoke:mcp
```

Expected:

- 7 tools present
- 5 UI resources present
- all UI resources have `text/html;profile=mcp-app`
- all UI resources include CSP and Trusted Types

## Claude Web Manual Verification

Run these prompts in a fresh Claude Web chat with SSW Compass enabled:

1. `技能実習2号から特定技能1号・農業へ変更したい。どの申請で、どの表が必要？`
2. `特定技能1号・農業で必要書類チェックリストを見せて。省略できる書類も分けて`
3. `特定技能1号・農業の手続きで、まず何から確認すべき？`
4. `特定技能1号の更新期限を2026年7月基準で確認して`
5. `留学ビザの人を農業でフルタイム雇用してよいか確認して`

Check:

- `classify_procedure` shows 4 chip rows.
- `list_visa_documents` shows grouped sections and omission candidates.
- `search_visa` starts with sources collapsed.
- `get_deadline_timeline` no longer shows a default source-card stack.
- `validate_zairyu_compatibility` renders a warning panel for illegal-work risk.

## Screenshot Gate

Capture screenshots following [`screenshot-capture-guide.md`](screenshot-capture-guide.md),
then run:

```bash
pnpm check:submission:strict
```

Strict mode must pass before Anthropic/OpenAI submission.


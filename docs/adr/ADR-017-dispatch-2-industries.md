# ADR-017: Dispatch industry restriction — 2 industries only (agriculture + fishery)

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 10)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `packages/shared-types/src/ssw-industries.ts`,
  `packages/shared-types/src/dispatch/validate.ts` (new),
  `apps/server/src/tools/list-visa-documents/handler.ts`

---

## Context

v4 §0 判断 E and v4 §5.2 state:

> 派遣可能分野は**農業・漁業の2分野のみ** (タスク文の「4分野」は誤り、v4 で訂正)

The v4-supplement.md was authored after strategy research identified that
the current statutory framework for Specified Skilled Workers (特定技能) permits
the dispatch (労働者派遣) employment arrangement only for:
- **農業 (Agriculture)** — 農林水産省 所管
- **漁業 (Fishery)** — 農林水産省 所管

All other 14 industries must use **direct employment (直接雇用)**.

This is established in the 特定技能制度 運用要領 (operational guidance).
The previous task description mentioning "4 industries" was incorrect and
was corrected in v4 §5.1.

---

## Decision

### 1. `DISPATCH_ALLOWED_INDUSTRIES = ["agriculture", "fishery"] as const`

Already established in `packages/shared-types/src/ssw-industries.ts` (Batch 1).
This ADR formally documents the legal basis and expansion policy.

### 2. `assertDispatchAllowed(industry: SswIndustry): asserts industry is DispatchAllowedIndustry`

Server-side guard that throws `DispatchNotAllowedError` when an industry
that does not permit dispatch is provided. Called in any handler that
creates dispatch-specific documents (派遣計画書, 派遣先概要書).

### 3. Expansion policy

Any future addition to `DISPATCH_ALLOWED_INDUSTRIES` requires:
1. Verification from 出入国在留管理庁 official guidance (一次ソース必須)
2. Superseding this ADR with a new ADR
3. A code change to `ssw-industries.ts` with an ADR reference comment

Sprint 4 does NOT expand beyond 2 industries regardless of v4 §5.1's
"Sprint 5 → dispatch management ledger" roadmap.

---

## Consequences

### `DispatchNotAllowedError` message

```typescript
`労働者派遣形態が認められるのは農業・漁業の2分野のみです (${industry} は不可)。
詳細: https://www.moj.go.jp/isa/applications/ssw/10_00020.html`
```

### Sprint 5 carry-over

Sprint 5 targets dispatch management ledger (派遣管理台帳), clash date
management (抵触日管理), and margin rate disclosure (マージン率公開).
These are NOT in scope for Sprint 4. Expansion of DISPATCH_ALLOWED_INDUSTRIES
is only permitted after ADR-017 is superseded.

---

## Related

- v4 §0 判断 E: "派遣可能分野は農業・漁業の2分野のみ"
- v4 §5.1: Sprint 4 派遣スコープ
- ADR-014: HITL (dispatch document generation uses L1/L2 gating)
- sprint-4-plan §3.6: dispatch validation interface

# URL Health Report — 2026-04-29

> **Purpose**: Vertex real-mode readiness check after source-index fixes.
> **Current state**: 45 entries, 41 ok, 4 failed, 0 placeholders.

---

## Summary

| Metric | Value |
|---|---:|
| Total entries | 45 |
| OK (hash computed) | 41 |
| Failed / blocked / timeout | 4 |
| `contentSha256 == "__PLACEHOLDER__"` | 0 |
| visa_legal | 37 |
| visa_secondary | 6 |
| visa_faq | 2 |

`data/source-index.jsonl` now has zero placeholders. Live entries have real SHA-256 hashes.
Failed entries are explicitly marked `status: "failed"`, `contentSha256: "UNVERIFIED"`, with `lastFailureReason`.

---

## Remaining failed entries (4)

| ID | URL | Reason | Next action |
|---|---|---|---|
| `maff-ssw-agriculture` | `https://www.maff.go.jp/j/new_farmer/n_syurou/t_ginou.html` | 403 Forbidden | Find current MAFF SSW agriculture page or official PDF |
| `meti-top` | `https://www.meti.go.jp/` | timeout | Keep as navigation only or remove |
| `meti-ssw-overview` | `https://www.meti.go.jp/english/policy/economy/human_resources/index.html` | timeout | Replace with accessible METI manufacturing/industrial products page |
| `meti-manufacturing-field` | `https://www.meti.go.jp/policy/economy/human_resources/index.html` | timeout | Replace with accessible METI manufacturing page |

---

## New entries added in Sprint 5

| ID | Datastore | URL | Purpose |
|---|---|---|---|
| `moj-isa-ssw-faq` | visa_faq | `https://www.moj.go.jp/isa/policies/ssw/faq.html` | Official SSW Q&A |
| `moj-isa-ssw-faq-online` | visa_faq | `https://www.moj.go.jp/isa/applications/online/online-QA.html` | Online application Q&A |
| `moj-isa-ssw-policy-2026` | visa_legal | `https://www.moj.go.jp/isa/03_00170.html` | 2026 policy / field policy update |
| `moj-isa-ssw-applications-index` | visa_legal | `https://www.moj.go.jp/isa/applications/ssw/index.html` | Current SSW application index |
| `moj-isa-ssw-2024-kakugi` | visa_legal | `https://www.moj.go.jp/isa/applications/ssw/2024.03.29.kakugikettei.html` | 4 new industries evidence |

---

## Vertex real-mode gating

Do NOT claim Vertex real mode complete until:

- [x] `contentSha256` placeholders = 0
- [x] ≥ 40 live hashed entries
- [x] visa_faq > 0 (now 2)
- [ ] MAFF/METI failed entries replaced or explicitly withdrawn
- [ ] gyoseishoshi review signs off on URLs
- [ ] `pnpm run ingest -- --mode=best-effort` completes
- [ ] staging `SSW_VERTEX_MODE=real` smoke passes
- [ ] prod `SSW_VERTEX_MODE=real` smoke passes

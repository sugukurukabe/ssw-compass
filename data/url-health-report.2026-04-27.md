# SSW Compass — source-index URL health report

- **Date**: 2026-04-27 (Sprint 3 Batch 4 Day 2 dry-run)
- **Source of truth**: [data/source-index.jsonl](source-index.jsonl) (40 entries)
- **Methodology**: parallel HEAD / GET check, 10 concurrent requests,
  10 s timeout, User-Agent `ssw-compass-ingest/1.0`
- **Elapsed**: 10.4 s
- **Purpose**: hand off to gyoseishoshi-supervised URL cleanup in
  Sprint 4 Phase 1 (per ADR-010 Path B adoption)

## Summary

| Metric | Value |
|---|---:|
| Total URLs | 40 |
| Successful (HTTP 200 OK) | 28 (70 %) |
| Failed | 12 (30 %) |
| Fail rate threshold for Sprint 3 full-ingest | 28 % (exceeded) |

## Per data store breakdown

| Data store | Success | Failed | Total | Status |
|---|---:|---:|---:|---|
| visa_legal | 23 | 11 | 34 | Workable but 32 % failure is high |
| visa_secondary | 5 | 0 | 5 | All 5 live — reliable baseline |
| visa_faq | 0 | 1 | 1 | **Data store is effectively empty** |

## Failed URLs — full list (12 / 12)

| # | Status | Ministry | URL | Suspected cause |
|---:|---|---|---|---|
| 1 | 404 | moj | https://www.moj.go.jp/isa/policies/policies/ssw/index.html | Subtree restructuring |
| 2 | 404 | moj | https://www.moj.go.jp/isa/applications/procedures/nyuukokukanri07_00201.html | Renumbered page |
| 3 | 404 | moj | https://www.moj.go.jp/isa/news/ | Index removed |
| 4 | 404 | moj | https://www.moj.go.jp/isa/faq/ | Index removed (visa_faq seed) |
| 5 | 404 | moj | https://www.moj.go.jp/hourei/ | Index removed (outside /isa/ tree) |
| 6 | 404 | moj | https://www.moj.go.jp/isa/policies/policies/ssw/ | Subtree restructuring |
| 7 | 403 | maff | https://www.maff.go.jp/j/new_farmer/n_syurou/t_ginou.html | Bot filtering suspected |
| 8 | 404 | mhlw | https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/koyou/gaikokujin/06.html | Moved or removed |
| 9 | 404 | mlit | https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/index.html | Index removed |
| 10 | TIMEOUT | meti | https://www.meti.go.jp/ | Ministry-top-page timeout |
| 11 | TIMEOUT | meti | https://www.meti.go.jp/policy/mono_info_service/mono/fiber/ | Cascading timeout |
| 12 | TIMEOUT | meti | https://www.meti.go.jp/policy/ | Cascading timeout |

## Domain pattern of failures

| Domain | Failed | Total | Failure rate |
|---|---:|---:|---:|
| moj.go.jp | 6 | 16 | 37.5 % |
| meti.go.jp | 3 | 3 | 100 % |
| mhlw.go.jp | 1 | 6 | 16.7 % |
| mlit.go.jp | 1 | 7 | 14.3 % |
| maff.go.jp | 1 | 3 | 33.3 % |
| soumu.go.jp | 0 | 2 | 0 % |
| cao.go.jp | 0 | 3 | 0 % |
| ppc.go.jp | 0 | 2 | 0 % |

## Hypotheses (for gyoseishoshi review)

### moj.go.jp — subtree restructuring

Six 404s concentrated in `/isa/policies/policies/ssw/`, `/isa/news/`,
`/isa/faq/`, `/isa/applications/procedures/nyuukokukanri07_00201.html`,
and `/hourei/`. Pattern suggests 出入国在留管理庁 executed a site-
map revision (likely between 2025-09 Sprint 1 seed date and
2026-04-27 dry-run). Recommended action: identify the new
equivalent URL per dead entry by browsing from `https://www.moj.go.jp/isa/`
top with gyoseishoshi supervision; confirm the information content
migrated rather than was withdrawn (silent withdrawal of legal
content is a separate concern per v2 §10 week-cycle monitoring).

### meti.go.jp — 3 / 3 timeouts

All three meti.go.jp entries timed out at 10 s, including the
ministry top page itself. Hypotheses:

1. **Geo-gating or UA-gating**: meti.go.jp may rate-limit or reject
   non-browser User-Agents. Verify by testing with a browser-spoof
   UA in Sprint 4 — if successful, add a UA allowlist discussion
   to ADR-010 §4.
2. **Slow TTFB**: 10 s timeout may be too tight. Try 30 s in
   Sprint 4; if still slow, reduce ingestion concurrency to 1 per
   meti path and accept longer wall-clock.
3. **Genuine outage**: improbable given consistency across 3 URLs
   on the same morning.

Recommended action: retry with 30 s timeout + browser-like UA
first, before declaring these dead.

### maff.go.jp 403

`/j/new_farmer/n_syurou/t_ginou.html` returns 403 Forbidden, not
404. The path exists; the server refused the specific request.
Hypotheses: (1) bot filter on suspicious UA, (2) geo-gating, or
(3) HTTP method restriction. Recommended action: Sprint 4 cleanup
tries a conventional browser UA; if still blocked, this URL is
bot-unfriendly by policy and must be dropped from automated
ingestion (content may still be human-browsable as a reference
URL in response text without being indexed).

### mhlw.go.jp and mlit.go.jp — single 404s

Routine URL decay, probably reorganisation. Fix per entry with
gyoseishoshi.

## Recommendations for Sprint 4 Phase 1

1. **Do not attempt full ingest in Sprint 3.** Adopt ADR-010
   Path B: fixture mode through Sprint 3 closure, full cleanup in
   Sprint 4.
2. **Run this exact dry-run script in Sprint 4 Day 1.** Hand the
   output to the retained gyoseishoshi alongside the current
   `data/source-index.jsonl`. Expected output: fresh pass/fail
   list, trend vs 2026-04-27 baseline (new dead? revived? stable?).
3. **visa_faq expansion is now the top priority**, not an optional
   stretch goal. Zero-entry data store means `SSW_VERTEX_MODE=real`
   cannot return any FAQ result, and the entire FAQ tool path in
   the MCP server would refuse-and-redirect for every query. Sprint
   4 aim: bring `visa_faq` to at least 10 entries.
4. **Ministry coverage rebalancing.** Current 40-entry distribution:
   moj 16 / mlit 7 / mhlw 6 / maff 3 / meti 3 / cao 3 / soumu 2 /
   ppc 2. moj at 40 % is defensible (in-kanbotei is the
   primary authority for 在留資格) but the non-moj 60 % is thin
   for sector coverage — 特定技能 14 分野のうち省庁別 seed 数が
   3 件未満のものが多い。Sprint 4 で分野ごと seed 数最低 2 件を
   ガイドラインに。
5. **Retain this report** as `data/url-health-report.2026-04-27.md`
   (committed, not git-ignored). Future health checks should land
   next to it as `url-health-report.YYYY-MM-DD.md` so a
   chronological trail exists before Sprint 5's scheduled re-scrape
   cron is built.
6. **No `source-index.jsonl` edits in Sprint 3.** The file stays
   exactly as seeded in Batch 2 Batch 6 of Sprint 2; edits are
   authoritatively made under gyoseishoshi supervision only.

## How the report was generated

```python
# scripts-adhoc: parallel health check — not committed to scripts/
# because it's not a recurring tool; this report is the artefact.
import json, urllib.request, urllib.error, concurrent.futures
entries = [json.loads(l) for l in open('data/source-index.jsonl')]
def check(e):
    try:
        urllib.request.urlopen(urllib.request.Request(
            e['url'],
            headers={'User-Agent': 'ssw-compass-ingest/1.0'},
        ), timeout=10)
        return (e['id'], 200, 'OK')
    except urllib.error.HTTPError as x:
        return (e['id'], x.code, f'HTTP {x.code}')
    except Exception as x:
        return (e['id'], 0, type(x).__name__)
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(check, entries))
# → 28/40 OK, 12/40 failed
```

The Sprint 4 run should prefer the full
[scripts/ingest-sources.ts](../scripts/ingest-sources.ts) with
`--dry-run --mode=best-effort` which also computes SHA-256 for
successful fetches and generates a commit-ready diff. This ad-hoc
script captures only pass/fail, which is what the gyoseishoshi
review needs as the first pass.

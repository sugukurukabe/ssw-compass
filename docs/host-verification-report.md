# SSW Compass — 6-host verification report

- **Date range**: Sprint 3 Batch 7 (2026-04-28 kickoff; running updates)
- **Target**: `ssw-mcp-staging` Cloud Run service on `asia-northeast1`
- **Auth**: Bearer ID token (`gcloud auth print-identity-token --audiences=<SERVICE_URL>`);
  ADR-009 §Decision 6 `allow_unauthenticated=false` is in effect, per
  ADR-012 §Decision 2.
- **Scope**: per host, verify 3 MCP capabilities + 1 UX capability:
  1. `tools/list` returns 5 tools
  2. `tools/call search_visa` returns `structuredContent.results.length >= 2`
  3. `resources/read ui://ssw-search/mcp-app.html` returns HTML
  4. UI renders with Disclaimer footer + 3-language affordance + dark-mode
     + skeleton animation + freshness-warning stub
- Hosts that cannot be completed in Sprint 3 are flagged `→ Sprint 4 deferral`
  per ADR-012 §Consequences and `docs/sprint-4-pending.md` Phase 3 (
  "6-host coverage expansion").

## Backend smoke (Agent-captured, host-agnostic)

Captured from cd-staging `Smoke test (staging)` job at run
`25031985199` (commit land of Batch 7 Commit 2 hotfix #19 on main).
All 5 stages green.

| Check | Result | Note |
|---|---|---|
| /health 200 + `{status:"ok",service:"ssw-mcp"}` | PASS | WIF-minted ID token, SA `ssw-deploy@ssw-compass-prod-494613` |
| tools/list (expect 5 tools) | PASS | `search_visa`, `classify_procedure`, `get_deadline_timeline`, `list_visa_documents`, `_ssw_checklist_schema` |
| tools/call search_visa (fixture mode, expect results ≥ 2) | PASS | SSW_VERTEX_MODE=fixture per ADR-010 Path B; real mode activates in Sprint 4 Phase 1 |
| /.well-known/mcp.json | PASS | `.name == "SSW Compass"`, publisher `スグクル株式会社` |
| **resources/read ui://ssw-search/mcp-app.html** | PASS (Batch 7 new) | `mimeType` starts with `text/html` (actually `text/html;profile=mcp-app`, the ext-apps RESOURCE_MIME_TYPE constant), body starts with `<!doctype html>`, size = 299,118 bytes, contains `Content-Security-Policy-Report-Only` + `trusted-types ssw-purify` |

Cd-staging run artefact (5 JSON + 1 HTML payload) is attached to the
GitHub Actions run and is retained per default GHA policy (90 days).

Human 6-host verifications do NOT repeat these backend checks — they
test their local host's client UX instead.

## Per-host verification

### 1. Claude Desktop (mcp-remote bridge)

- **Config snippet** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

  ```json
  {
    "mcpServers": {
      "ssw-compass-staging": {
        "command": "npx",
        "args": ["-y", "mcp-remote", "<SERVICE_URL>/mcp", "--header", "Authorization:${ID_TOKEN}"],
        "env": {
          "ID_TOKEN": "Bearer $(gcloud auth print-identity-token --audiences=<SERVICE_URL>)"
        }
      }
    }
  }
  ```

  Real URL is discovered at runtime via `gcloud run services describe
  ssw-mcp-staging --region=asia-northeast1 --format='value(status.url)'`
  (ADR-012 §Ongoing guards — not committed).

- **Priority**: top (Anthropic Connectors Directory target host)
- **Status**: TBD (human verification pending)

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | Claude Desktop opens embedded iframe per ext-apps protocol |
| Disclaimer footer visible | TBD | |
| ja/en/id language switch | TBD | Requires at least one non-JP capture for Anthropic submission |
| Dark-mode contrast WCAG AA | TBD | |
| Skeleton animation plays on initial load | TBD | |
| Freshness warning visible when stale (test with fake old fixture) | TBD | |

### 2. Claude Web (Custom Connector)

- **Config path**: https://claude.ai → Settings → Feature Preview → Custom Connectors → Add Custom Connector
- **URL**: `<SERVICE_URL>/mcp`
- **Auth header**: `Authorization: Bearer <ID_TOKEN>`
- **Priority**: top (Anthropic Connectors Directory target host)
- **Status**: TBD

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | |
| Disclaimer + 3-lang + WCAG + skeleton + freshness | TBD | Same rubric as Claude Desktop |

### 3. VS Code GitHub Copilot

- **Config path**: `.vscode/mcp.json` (per-workspace) or user-level MCP server registry
- **Priority**: medium (developer-friendly host, defensible coverage)
- **Known unknown**: ID token header injection syntax differs between Copilot versions; Sprint 3 verifies current stable, future versions tracked separately
- **Status**: TBD

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | Copilot may not render MCP UI resources — if confirmed, defer UX checks |
| Backend checks only if UX skipped | TBD | |

### 4. Goose

- **Config**: `~/.config/goose/profiles.yaml` MCP section
- **Priority**: low-medium (less common Anthropic submission expectation)
- **Status**: TBD

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | |

### 5. Postman MCP

- **Config**: Postman Collection → new MCP request → Auth tab → Bearer Token
- **Priority**: low (API-tester tool, developer niche)
- **Note**: Postman natively supports Bearer token headers, expected easiest of the 6 to complete
- **Status**: TBD

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | Postman shows MCP resource as blob response, not rendered UI |

### 6. MCPJam

- **Config**: MCPJam web UI → Add Server → URL + Headers
- **Priority**: low
- **Status**: TBD

| Check | Result | Note |
|---|---|---|
| tools/list | TBD | |
| tools/call search_visa | TBD | |
| UI resource render | TBD | |

## Summary matrix

| Host | tools/list | tools/call | UI render | Submission-grade? |
|---|---|---|---|---|
| 1. Claude Desktop | TBD | TBD | TBD | top priority |
| 2. Claude Web | TBD | TBD | TBD | top priority |
| 3. VS Code Copilot | TBD | TBD | TBD | medium |
| 4. Goose | TBD | TBD | TBD | low |
| 5. Postman MCP | TBD | TBD | TBD | low |
| 6. MCPJam | TBD | TBD | TBD | low |

## Deferral decisions

For each host that cannot be completed in Sprint 3, note the blocker
and the Sprint 4 task reference:

| Host | Blocker | Sprint 4 action |
|---|---|---|
| _(filled as hosts get deferred)_ | | See `docs/sprint-4-pending.md` Phase 3 |

## Operator pointers

- Generate a fresh ID token:
  ```bash
  SERVICE_URL=$(gcloud run services describe ssw-mcp-staging \
    --region=asia-northeast1 --format='value(status.url)')
  TOKEN=$(gcloud auth print-identity-token --audiences="$SERVICE_URL")
  ```
- Token lifetime is 1 hour. Re-mint when a host prompts 401/403 after
  long idle.
- URL discipline: never paste the `SERVICE_URL` value into a committed
  file (ADR-012 §Ongoing guards). Host config references it via env /
  placeholder only.

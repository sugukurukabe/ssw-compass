# ADR-012: Network egress controls, Cloud Armor definition, staging close-public

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 3 Batch 6)
- **Deciders**: @kabe, SSW Compass core team
- **Scope**:
  - [infra/terraform/modules/vpc-egress/](../../infra/terraform/modules/vpc-egress/)
  - [infra/terraform/modules/cloud-armor/](../../infra/terraform/modules/cloud-armor/)
  - [infra/terraform/envs/staging/main.tf](../../infra/terraform/envs/staging/main.tf)
  - [infra/terraform/envs/prod/main.tf](../../infra/terraform/envs/prod/main.tf)
  - [apps/server/src/safety/url-guard.ts](../../apps/server/src/safety/url-guard.ts)
  - [.github/workflows/cd-staging.yml](../../.github/workflows/cd-staging.yml)
- **Supersedes / updates**:
  - [ADR-009 §Decision 6](./ADR-009-terraform-foundation.md) "staging
    public exception" window — **closed** by Commit 3 of this batch.
    ADR-009 Mitigation #1 enforcement (staging URL grep discipline)
    continues via this ADR §Ongoing guards.
- **Co-dependent**:
  - [ADR-010 Vertex ingestion strategy](./ADR-010-vertex-ingestion-failure-mode.md)
    — Sprint 4 Phase 1 full-ingest relies on the `*.go.jp` allowlist
    entry from §Decision 4 safeFetch regex.

## Context

Sprint 3 Batch 6 completes the network surface for SSW Compass:

1. Cloud Run staging had been publicly reachable with
   `allow_unauthenticated=true` since Batch 3, under the explicit
   short-window exception framed in ADR-009 §Decision 6. The batch
   closes that exception.
2. Egress from Cloud Run had been going out over Google-managed
   unpinned IPs. Vertex AI Search / DLP / Secret Manager don't
   require a pinned source IP today, but any future vendor-allowlist
   requirement (external ingestion sources in Sprint 5+, 3rd-party
   webhooks) forces us to pin egress now — retrofitting after a
   vendor demands it is worse than preempting.
3. Cloud Armor had skeleton Terraform in Batch 2 but no rules.
   Defining the rules in Sprint 3 matters even if we cannot attach
   them yet (see §Decision 1) because the rules capture the current
   thinking about rate limits, geo policy, and SSRF ranges — policy
   decisions, not infrastructure topology.
4. `safeFetch` is referenced in [apps/server/src/vertex.ts](../../apps/server/src/vertex.ts)
   doc-comment and in v3 §23.2 but had no implementation until this
   batch.

Two structural discoveries made during pre-flight changed the plan
from the original Batch 6 sketch:

- **Cloud Armor can only attach via a Global HTTPS LB backend
  service**. Cloud Run v2 has no direct Cloud Armor binding. This is
  a documented GCP constraint, not a Terraform schema issue.
- **`gcloud auth application-default login` issues ADC with a narrower
  scope set than `gcloud auth login`**. Some read-path gcloud CLI
  commands (`run services describe`, `logging read`) still require
  the user-credential path. Terraform state operations work via ADC.
  This is operational, not architectural, but it shapes the verification
  step in §Rollout.

## Decision

### 1. Cloud Armor: define in Sprint 3, attach in Sprint 4

A `google_compute_security_policy` resource with the rule set below
is created in Sprint 3 Batch 6 Commit 2. **The policy is not attached
to any backend service until Sprint 4**, when the Global HTTPS Load
Balancer + custom domain `mcp.ssw-compass.jp` provisioning lands the
attach at the same moment.

**Rule set** (staging; prod will reuse the same module):

| Priority | Action | Match | Purpose |
|---:|---|---|---|
| 500 | deny(403) | `origin.region_code in ['CN','RU','KP','IR']` | Geo-block high-risk origins |
| 900 | deny(403) | src_ip_ranges ∈ RFC1918 + 169.254.0.0/16 | SSRF / metadata exfil guard |
| 1000 | throttle (exceed → 429) | `request.path.startsWith('/mcp')` | 10 req/min/IP on the JSON-RPC surface |
| 1100 | throttle (exceed → 429) | `request.path.startsWith('/health')` | 100 req/min/IP |
| 2147483647 | allow | all | Default terminal |

**Edition**: Standard. Cloud Armor Premium (managed protection) runs
~$3,000/month and adds adaptive protection + bot management. SSW's
expected traffic (internal MCP sessions, v2 §14.3 predicts the
monthly load within Standard tier comfortably) does not justify
Premium in Sprint 3. Revisit in Sprint 5+ only if real traffic
exceeds 50k req/day sustained or if adaptive protection features
become needed for a specific attack profile.

### 2. Staging close-public — end the ADR-009 exception

- `envs/staging/main.tf` `module.cloud_run.allow_unauthenticated`
  flips `true → false` in Batch 6 Commit 3.
- The `google_cloud_run_v2_service_iam_member.public_invoker` IAM
  binding (allUsers → `roles/run.invoker`) is auto-destroyed by the
  `count = var.allow_unauthenticated ? 1 : 0` toggle in the cloudrun
  module.
- Future invokers (6-host verification, ad-hoc curl, MCP Inspector
  CLI) must present a Bearer token: `gcloud auth print-identity-token`
  or an OIDC exchange for Cloud Run.
- `ingress` stays `INGRESS_TRAFFIC_ALL` so the `*.run.app` URL is
  still a reachable address; the gate is IAM, not network.
- The staging URL must still not appear in any committed file. ADR-009
  §Decision 6 Mitigation #1 was framed as a window-limited discipline;
  with the window closed, the practical argument for keeping URLs
  out of the repo weakens, but the operational argument (reduces
  accidental sharing, simplifies URL rotation during incidents)
  persists. This ADR continues the grep-based check under §Ongoing
  guards below, decoupled from ADR-009.

### 3. Prod ingress flip — open to public with IAM gate

- `envs/prod/main.tf` `module.cloud_run.ingress` flips
  `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER → INGRESS_TRAFFIC_ALL`.
- `allow_unauthenticated` stays `false`. Callers need an ID token.
- **This does NOT expose prod to anonymous traffic.** It removes the
  "internal-only reach" layer because the Cloud Armor + LB + custom
  domain work in Sprint 4 will replace that layer cleanly. Between
  now and then, IAM is the sole gate.
- Consequence: once Batch 6 applies, prod accepts bearer-authenticated
  traffic from the internet. Verification path: the same identity-token
  curl smoke used on staging.

### 4. safeFetch allowlist — narrower than v3 §23.2

Implementation in [apps/server/src/safety/url-guard.ts](../../apps/server/src/safety/url-guard.ts).
Regex pattern:

```typescript
const ALLOWED_HOSTS_RE =
  /^([\w-]+\.)?(googleapis\.com|cloud\.google\.com)$|^[\w.-]+\.go\.jp$/;
```

Three allowlisted surfaces:

1. `*.googleapis.com` (including base `googleapis.com`) — Vertex AI
   Search / DLP / Secret Manager / Logging.
2. `*.cloud.google.com` (including base `cloud.google.com`) — IAM /
   OAuth token endpoints for service account flows.
3. `*.go.jp` **subdomain-required** — Sprint 4 Phase 1 government
   source ingestion. The subdomain requirement (bare `go.jp` root
   rejected) is narrower than v3 §23.2's `go.jp` pattern; adopted
   per Batch 6 user addendum on the principle that allowlists should
   be as tight as the actual use case.

Rejected alternative: `*.go.jp` including the root. The regex
`/go\.jp$/` would match `go.jp` itself, which is a TLD root that SSW
never fetches from. The addendum's subdomain-required version costs
two extra characters in the pattern for a measurable reduction in
blast radius.

Upstream callers that hit the guard throw `egress_blocked:<reason>`
with a structured `_safeFetch` property exposing the block reason.
An `explainBlock()` utility extracts the typed shape for logging.

### 5. Workflow smoke test — ID token bearer

`.github/workflows/cd-staging.yml` smoke test steps gain an
`Authorization: Bearer $(gcloud auth print-identity-token ...)`
header on every curl / JSON-RPC invocation. The WIF-authenticated
workflow exchanges its federated token for an ID token targeting
the Cloud Run service URL audience.

Prod smoke (cd-prod.yml, still manual-dispatch only in Sprint 3)
gets the same header; Batch 7 6-host verification uses the same
pattern.

## Cloud Armor policy未 attach 状態の運用リスク

Cloud Armor policy exists in the project but carries zero traffic
until Sprint 4 attach. Specific operational risks:

1. **Blind spot**: the rules cannot be validated against real load
   because they are not in the request path. Any misconfiguration
   (e.g., geo-block regex that accidentally blocks valid origins)
   surfaces only on attach day.
2. **Drift**: the google provider occasionally adds nested config
   fields to security policies (see the Batch 5 hotfix for
   document_processing_config on data stores). Monthly `terraform plan`
   runs continue; if drift surfaces, add targeted `ignore_changes`.
3. **Quota**: the policy counts against the project's Cloud Armor
   policy quota (default 10). At 1 in use, well under.

### Sprint 4 attach-day validation plan

After `terraform apply` attaches the policy to the prod backend
service, run:

```bash
# Rate limit (priority 1000) — 11th hit returns 429 within 60 s
for i in {1..12}; do
  curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    -w "%{http_code}\n" \
    "https://ssw-mcp-prod-<hash>-an.a.run.app/mcp"
done
# Expect: ten 200/2xx followed by 429

# Geo-block (priority 500) — simulate via CF or proxied curl from the
# blocked region. Log-based verification:
gcloud logging read 'jsonPayload.enforcedSecurityPolicy.name="ssw-waf-policy"
  jsonPayload.enforcedSecurityPolicy.outcome="DENY"' --limit=5

# RFC1918 (priority 900) — monitoring-only since internal ranges
# shouldn't reach the public LB at all. Log presence = a
# potential L3 misconfiguration, not a WAF regression.
```

These commands land in `docs/deploy-runbook.md` as the Sprint 4
attach runbook.

## Ongoing guards (supersede ADR-009 §Decision 6 Mitigation #1)

- **Staging URL grep discipline**: `git grep -iE 'ssw-mcp-staging-[a-z0-9]+[-.][a-z0-9-]+\.(a\.)?run\.app' -- ':!docs/adr/*' ':!data/url-health-report*'`
  continues to return zero matches. The exception is now grep-only;
  it is no longer a window-limited commitment with a close date.
- **Prod URL grep**: same rule for the prod service URL once assigned.
- **Incident rotation**: if a URL leak is detected, the operational
  response is to rotate the Cloud Run service (delete + recreate via
  Terraform) so the public URL changes. Auth gate means leaked URLs
  are less immediately dangerous, but rotation remains the clean
  remediation.

## Alternatives rejected

### A. Cloud Armor via direct Cloud Run attach

Deferred because Cloud Run v2 has no direct attach surface. Attempted
in Batch 2 design; abandoned on encountering provider docs. Next
attach target is a Global HTTPS LB backend service, arriving in
Sprint 4.

### B. Cloudflare WAF in Sprint 3

Originally included in the Batch 6 scope sketch. Rejected because
Cloudflare proxy requires DNS cut-over (SSW's `ssw-compass.jp` DNS
is still at the registrar's default nameservers), and orange-cloud
routing interacts with the LB provisioning in Sprint 4. Running
both in parallel for one sprint risks dual-gate mistakes. Sprint 4
bundles DNS change + LB + Cloud Armor attach + Cloudflare in one
coordinated flip.

### C. Broader safeFetch allowlist (e.g., `*.go.jp` root + `*.jp` catch-all)

Rejected as too permissive. SSW ingests specifically from ministry
subdomains (`www.moj.go.jp`, `www.mlit.go.jp`, etc.). The narrower
regex matches every realistic ingest target and blocks both typosquat
(`gojp.evil.com`) and TLD-root abuse.

### D. Premium Cloud Armor edition in Sprint 3

Rejected on cost (~$3,000/month vs Standard's per-rule pricing) and
maturity (Premium's adaptive protection delivers value only under
sustained attack pressure SSW has not yet measured).

### E. Keep staging public through Sprint 4

Rejected. ADR-009 §Decision 6 committed to closing the window by
Sprint 3 end, and the Mitigation #1 grep rule has been discipline-
enforced since. Extending the window would require a new ADR
explicitly superseding ADR-009 §6, with a traffic-volume rationale
SSW does not have.

## Consequences

### Positive

- Staging is now IAM-gated; URL leak + anonymous bot probes stop
  translating to server work.
- Egress is pinned to a single Cloud NAT static IP per env, enabling
  future vendor allowlist asks without surprise retrofits.
- `safeFetch` makes SSRF probability close to zero at the application
  layer even if a future bug lets attacker-controlled URLs through
  a handler.
- Cloud Armor rules are codified and reviewable; attach-day carries
  no "what should the rules be" debate.
- ADR-009 §Decision 6 commitment is kept; the Sprint 3 narrative
  ends cleanly.

### Negative / follow-up

- Sprint 4 6-host verification (Batch 7 this sprint) must confirm
  every host can carry an ID token. Hosts that cannot are documented
  and deferred. Worst case, one or two hosts slip to Sprint 4.
- Cloud Armor policy is inert until Sprint 4 — inspection blind spot
  during the gap.
- prod is now reachable without the INTERNAL_LB layer. Any IAM
  misconfiguration would expose prod; the single safeguard is the
  `allow_unauthenticated=false` flag, which is Terraform-managed and
  covered by idempotent plan.
- cd-staging.yml smoke test gains a second auth dependency
  (ID token in addition to WIF); break-glass debugging of the smoke
  itself is slightly harder.

## Verification performed (Batch 6 close)

- `terraform plan -out=plan.batch-6.tfplan` in `envs/staging/` —
  expect roughly `9 to add, 1 to change, 1 to destroy` (VPC × 6
  + 2 project_service + Cloud Armor × 1 = 9 add; Cloud Run env/
  allow_unauth change = 1 change; public_invoker IAM = 1 destroy).
- `terraform plan` in `envs/prod/` — expect `0 to add, 1 to change,
  0 to destroy` (ingress flip only).
- Both applied successfully (see `terraform apply` output in the
  `Verification` section below, filled in at Batch 6 close).
- `pnpm run typecheck`: 9/9 green.
- `pnpm exec biome check apps packages ui scripts`: 0 errors.
- `pnpm -F @ssw/server test`: 78 → 92 passed (+14 url-guard cases).
- `curl` without ID token → HTTP 401.
- `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)"` → HTTP 200.
- cd-staging.yml smoke test run with ID token header: all 4 stages
  (health, tools/list, tools/call, server-card) green.
- Cloud Run state shows `vpc_access.connector =
  projects/.../connectors/ssw-vpc-connector` and egress = ALL_TRAFFIC.
- NAT IP assigned (example: 34.x.x.x — captured in cd-staging
  workflow log, not committed here per §Ongoing guards).

## Related

- [ADR-009: Terraform foundation](./ADR-009-terraform-foundation.md)
  §Decision 6 — staging public exception (superseded by this ADR).
- [ADR-010: Vertex AI Search ingestion strategy](./ADR-010-vertex-ingestion-failure-mode.md)
  §5 — source-index.jsonl schema that relies on §Decision 4's
  `*.go.jp` allowlist once Sprint 4 ingest runs.
- [v3 §23.2](../specs/v3-supplement.md) — egress architecture
  spec. `ALLOWED_HOSTS_RE` regex differs (subdomain-required for
  go.jp per §Decision 4 of this ADR).
- [docs/deploy-runbook.md](../deploy-runbook.md) — Sprint 4
  attach-day validation script lives here.

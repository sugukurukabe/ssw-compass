# ADR-009: Terraform foundation — state backend, provider pinning, env split, staging-public exception

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 3 Batch 2)
- **Deciders**: @kabe, SSW Compass core team
- **Scope**: [infra/terraform/](../../infra/terraform/) — the entire
  Sprint 3 infrastructure-as-code surface, plus two bootstrap artefacts
  (API enable + GCS state bucket) that Terraform itself cannot create.
- **Supersedes**: None. Co-dependent with
  [ADR-007 (brand rename)](./ADR-007-brand-renaming.md)
  (project id `ssw-compass-prod-494613` assumes the SSW Compass brand).

## Context

Sprint 3 moves SSW Compass from "localhost + `pnpm dev`" to
"Cloud Run staging + GitHub Actions CD". That move requires persistent
infrastructure state and a deterministic way to reproduce it on a new
laptop or CI runner. The Sprint 3 kickoff prompt framed four questions
for Batch 2 that this ADR answers:

1. **State backend** — where does `terraform.tfstate` live, how is it
   locked, how is it recovered from accidental loss.
2. **Provider version pinning** — what Terraform core version and
   `hashicorp/google` provider version are we committed to, and why.
3. **Existing-resource audit** — does `ssw-compass-prod-494613` already
   contain any manual resources that would need `terraform import`.
4. **Secret Manager naming** — the convention secrets will follow,
   published before any secret is created.

Two additional issues surfaced during Batch 2 Interface Freeze that
belong in the same document, because they affect the same files:

5. **Provider version drift from the kickoff prompt.** The prompt
   recommended `terraform ~> 1.9` and `hashicorp/google ~> 6.0`.
   Terraform Registry as of 2026-04-27 reports Terraform 1.14.9 and
   google provider 7.29.0 as current stable. The kickoff-prompt pins
   would bind SSW to the pre-v7 major line and miss Cloud Run v2
   topology features. Decision: override the kickoff-prompt pins with
   registry-current majors. Reasoning is documented in §Decision.

6. **Cloud Run ingress trade-off for the Sprint 3 test window.**
   Prod wants `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` until Batch 6
   stands up Cloud Armor + Cloudflare. But Batches 4–5 need a publicly
   reachable URL from `cloudflared tunnel` and MCP Inspector to drive
   integration tests against real Vertex AI Search + real DLP.
   `INGRESS_INTERNAL_LOAD_BALANCER` blocks both. Staging takes the
   hit so prod stays locked.

## Decision

### 1. State backend

- **GCS bucket** `ssw-compass-tf-state` in `asia-northeast1`,
  STANDARD storage, uniform bucket-level access, public access
  prevention `enforced`, Object Versioning on, lifecycle rule
  deleting non-current versions after 90 days.
- **Env isolation** by `prefix` within the single bucket:
  `staging/terraform.tfstate`, `prod/terraform.tfstate`.
- **Locking** = native GCS object generation preconditions (Terraform
  1.10+). No DynamoDB-equivalent lock table, no `google_storage_bucket`
  separate lock object, no `terraform force-unlock` playbooks other
  than the stock one.
- **Bucket Lock = OFF.** State is by definition mutable. Bucket Lock
  would make every failed `terraform apply` unrecoverable.
- **Bootstrap is a one-time manual step** captured verbatim in
  [docs/deployment-checklist.mdc](../../.cursor/rules/deployment-checklist.mdc)
  and re-documented in this ADR's §Bootstrap sequence below. It is
  `gcloud storage buckets create` + `gcloud storage buckets update` +
  label attach. No Terraform involvement — rationale in §Alternatives
  rejected C.

### 2. Provider version pinning (override kickoff-prompt drift)

- **Terraform core:** `~> 1.14` (≥ 1.14.0, < 2.0.0). Registry current
  stable is 1.14.9, locally installed is 1.14.3. The kickoff prompt
  proposed `~> 1.9` (≥ 1.9.0, < 2.0.0). Both constraints admit 1.14.x,
  but `~> 1.14` floors the minimum at the current stable, which is a
  sharper signal to future contributors about the tested combination.
- **hashicorp/google provider:** `~> 7.0` (≥ 7.0.0, < 8.0.0).
  Registry current stable is 7.29.0 (released 2026-04-21). The kickoff
  prompt proposed `~> 6.0` with "or current latest" explicitly
  allowed. Provider 7.0 ships the Cloud Run v2 topology fields (vpc_access
  egress semantics, `max_instance_request_concurrency` on v2 services)
  that this module tree relies on.
- **Single `versions.tf` at `infra/terraform/versions.tf`.** All envs
  inherit via proximity; no per-env divergence.
- Rationale for rejecting the kickoff-prompt `~> 1.9` / `~> 6.0`
  drift is in §Alternatives rejected D.

### 3. Existing-resource audit

- `gcloud asset search-all-resources` could not be run because
  `cloudasset.googleapis.com` is intentionally NOT in the Batch 2
  enable list (v2 §8.2 minimisation principle — do not enable what you
  do not need this sprint).
- Per-service direct enumeration produced the following at Batch 2
  kickoff:

  | Resource type | Command | Count |
  |---|---|---|
  | IAM service accounts | `gcloud iam service-accounts list` | 0 (`Listed 0 items.`) |
  | GCS buckets | `gcloud storage buckets list \| wc -l` | 0 before this ADR's bootstrap step |
  | WIF pools (global) | `gcloud iam workload-identity-pools list` | 0 |
  | Cloud Run services | (API disabled → 0 by definition) | 0 |
  | Artifact Registry repos | (API disabled → 0 by definition) | 0 |
  | Secret Manager secrets | (API disabled → 0 by definition) | 0 |

- **Conclusion: clean state.** No `terraform import` required. Every
  resource managed by this module tree is created from scratch by
  `terraform apply` in Batch 3. If a future resource turns out to
  pre-exist (e.g., the project's default Compute Engine SA), it will
  be caught by the `google_service_account` resource refusing to
  create a duplicate, and the import cost will be bounded to that
  single resource.

### 4. Secret Manager naming convention

- Pattern: `<service-name>-<purpose>`.
- Validated in
  [modules/secret-manager/variables.tf](../../infra/terraform/modules/secret-manager/variables.tf)
  with the regex `^[a-z][a-z0-9-]*[a-z0-9]$` and a 60-char length cap
  (Secret Manager itself allows 255; 60 is our internal ceiling for
  readability in Cloud Run env mounts).
- Reserved names (not created in Batch 2; the module's `secret_names`
  default is `[]`):

  | Name | Consumer | Created in |
  |---|---|---|
  | `slack-webhook-alerts` | Cloud Logging sink → Slack | Sprint 5+ |
  | `freshness-pagerduty-key` | freshness-warning cron → PagerDuty | Sprint 5+ |
  | `dlp-custom-infotype-key` | Cloud DLP custom infoType rules | Batch 5 |

- `vertex-api-key` is explicitly NOT reserved: the BYOSA
  (`ssw-runtime`) authenticates to Discovery Engine via IAM
  (`roles/discoveryengine.viewer`), not a long-lived API key.
- IAM binding: every secret under this module grants
  `roles/secretmanager.secretAccessor` to `ssw-runtime` by default
  (via `accessor_members` passed from the env). Per-secret scoping
  can be introduced later with conditions.

### 5. Environment split & apply sequencing

- Two envs: `envs/staging/` and `envs/prod/`.
- **Staging owns the shared resources.** `ssw-runtime` + `ssw-deploy`
  service accounts, IAM bindings, WIF pool + provider, Artifact
  Registry, and the 9 `google_project_service` entries live in the
  staging state. Prod state only holds prod-specific Cloud Run +
  prod-specific Logging bucket.
- **Prod references shared resources by value, not by data source.**
  Prod uses the hardcoded email
  `ssw-runtime@ssw-compass-prod-494613.iam.gserviceaccount.com` for
  Cloud Run attachment. `data "google_service_account"` is avoided
  because it would fail `terraform plan` before staging has been
  applied.
- **Apply order (Batch 3 gating):**
  1. `terraform apply plan.staging.tfplan` (creates shared resources)
  2. `terraform apply plan.prod.tfplan` (attaches to shared resources)
- **Destroy order** (if needed): prod first, then staging. A
  `terraform destroy` in staging without first destroying prod will
  orphan prod's Cloud Run reference to a non-existent SA email.
  This risk is documented here and repeated in the per-env
  `backend.tf` comments.
- Rationale for rejecting the `envs/shared/` dedicated env and the
  single-monolithic-state alternatives is in §Alternatives rejected E
  and F.

### 6. Cloud Run ingress & invoker policy (Sprint 3 short-window exception)

- **Staging**
  - `ingress = INGRESS_TRAFFIC_ALL`
  - `allow_unauthenticated = true` (binds `allUsers` to
    `roles/run.invoker`)
  - `max_instance_count = 2`
  - `max_instance_request_concurrency = 80` (Cloud Run default)
  - **Duration of exception**: Batch 2 through Batch 7. At Batch 8
    (Sprint 3 closure) staging is re-planned with
    `allow_unauthenticated = false` and placed behind the same Cloud
    Armor + Cloudflare front as prod.
  - **Abuse mitigations in force during the exception**:
    1. The staging URL is not written to `README.md`,
       `.claude/desktop_config.example.json`, or any file in the
       repository. It is a runtime discovery via `gcloud run services
       describe`.
    2. `max_instance_count = 2` caps throughput damage — even a
       sustained 80 req/s flood per instance maxes at 160 req/s.
    3. Cloud Run billing with `min_instance_count = 0` means the
       worst-case cost of idle-but-attackable staging is ≈ 0.
    4. The `ssw-mcp-staging` service can be deleted in a single
       `gcloud run services delete ssw-mcp-staging` call if abuse
       is detected, with no state loss (the state is Terraform-managed
       and reapply-able).
- **Prod**
  - `ingress = INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`
  - `allow_unauthenticated = false`
  - `max_instance_count = 20`
  - Public reachability is introduced **only** in Batch 6 after
    Cloud Armor + Cloudflare are live, by changing `ingress` to
    `INGRESS_TRAFFIC_ALL` and keeping `allow_unauthenticated = false`
    (invocation via a signed token from the load balancer).
- **Why staging can tolerate what prod cannot.** Staging's attack
  surface is a `gcr.io/cloudrun/hello` placeholder container during
  Batch 2, replaced by the SSW Compass server in Batch 3. Even then,
  the server's tools are read-only, return only primary-source URLs
  ≥ 0.7 confidence, and scrub PII before any retrieval. The worst
  anyone can extract via a flooded staging is a copy of public
  immigration-bureau text. Prod is the label we hand customers; the
  reputational cost of a prod incident is higher than staging's.

#### Mitigation #1 enforcement (operational)

URL leakage prevention is operational, not technical. Periodic checks:

- `git grep -iE 'ssw-mcp-staging-.*\.run\.app' -- ':!docs/adr/ADR-009*'`
  should return zero matches.
- Run this grep before each batch commit.
- If a staging URL is found in a non-ADR file, treat as a security
  finding, redact the URL, and create a new commit with the redaction
  (do not force-push if the leak has already been pushed — the git
  history is public, so rotation of any exposed artefact is the only
  real fix).

This grep can be promoted to a Husky pre-commit hook in Sprint 5+ if
the temporary exception is extended for any reason. Until then, the
short Sprint 3 window (Batches 2–7) is considered short enough that
manual grep discipline suffices.

### 7. API enablement

- **Terraform-tracked** via `google_project_service` in
  `envs/staging/main.tf`, with `disable_on_destroy = false` and
  `disable_dependent_services = false` — destroying staging does not
  disable the APIs (other envs, ad-hoc `gcloud` usage, and this very
  ADR's read-only `gcloud` tooling all depend on them).
- **Bootstrap duplication note**: the 9 APIs were pre-enabled via
  `gcloud services enable` at Batch 2 start so this ADR's audit
  commands can run. The Terraform resources are "additive" —
  `google_project_service` on an already-enabled API is a no-op.

## Bootstrap sequence (ran once at Batch 2 start, before any
`terraform init`)

```bash
# 1. Enable 9 APIs
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  serviceusage.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project=ssw-compass-prod-494613

# 2. Create state bucket
gcloud storage buckets create gs://ssw-compass-tf-state \
  --project=ssw-compass-prod-494613 \
  --location=asia-northeast1 \
  --uniform-bucket-level-access \
  --public-access-prevention

# 3. Versioning + lifecycle + labels
cat > /tmp/ssw-tf-state-lifecycle.json <<EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "daysSinceNoncurrentTime": 90,
        "isLive": false
      }
    }
  ]
}
EOF

gcloud storage buckets update gs://ssw-compass-tf-state \
  --versioning \
  --lifecycle-file=/tmp/ssw-tf-state-lifecycle.json \
  --update-labels=env=shared,owner=ssw-compass,cost-center=ssw-compass-infra,managed-by=bootstrap

rm /tmp/ssw-tf-state-lifecycle.json
```

These four calls are idempotent-safe: re-running them on an
already-bootstrapped project is a no-op. They are not wrapped in a
script because running them by hand is part of the blast-radius
awareness we want new contributors to have. The lifecycle rule is
materialised via a temp file (not `<(echo ...)` process substitution)
for portability across POSIX shells and for auditability — the
exact JSON written to `/tmp` is the JSON GCS stores, visible to a
reviewer mid-bootstrap.

## Alternatives rejected

### A. Local state (instead of GCS backend)

Using `terraform.tfstate` on the operator's laptop or on CI runner
disk. Rejected: state is not shareable across machines; loss of the
laptop loses recovery. Every state mutation in CI would overwrite
whatever the developer had locally, guaranteeing drift. GCS versioning
also provides 90-day recovery that local filesystems do not.

### B. Terraform Cloud

HashiCorp-hosted state + plan/apply runs. Rejected: adds a third
SaaS dependency (alongside GCP and GitHub) and introduces an egress
path for state content that would need its own security review.
Free tier's 5-user cap is also a known future friction point when
the team grows. GCS backend inside our own project keeps state
residency identical to the resources it describes.

### C. Bootstrap via Terraform (chicken-and-egg)

Using Terraform to create the state bucket the backend will live in.
Rejected: would require a second backend (local or another bucket)
to hold that bootstrap's state, which re-opens the original question
at one level of indirection. Manual `gcloud storage buckets create`
terminates the recursion.

### D. `terraform ~> 1.9` / `hashicorp/google ~> 6.0` (kickoff-prompt pins)

The Sprint 3 kickoff prompt proposed these pins. Rejected: Terraform
Registry check at 2026-04-27 reports 1.14.9 / 7.29.0 as current
stable. The Anti-Hallucination workspace rule requires registry
confirmation before any version commitment; registry confirmation
invalidates the original pins. A greenfield Sprint 3 project takes
the registry-current majors — there is no upgrade friction because
there is no installed older version, and provider 7.0 ships Cloud
Run v2 topology fields (`vpc_access.egress`,
`max_instance_request_concurrency`) we rely on.

### E. `envs/shared/` dedicated env for project-scoped resources

A third env alongside `staging/` and `prod/` to hold SAs, WIF, AR,
and project_services. Cleaner conceptually. Rejected: requires
`terraform_remote_state` wiring (brittle across state-file moves) or
hardcoded outputs (same rigidity as our chosen approach, just moved
one level away). The complexity cost outweighs the benefit for
Sprint 3's two-env footprint. Revisit if a third env (e.g., `dev/`)
is ever added.

### F. Single monolithic state covering both envs

One `envs/all/` directory with staging and prod resources in one
state file. Rejected: loses per-env blast-radius isolation — a
staging `apply` error would also touch prod state. The point of
env separation is to make prod-touching an explicit `cd envs/prod
&& terraform apply`, not a side effect of any other operation.

### G. Prod public from Batch 2 (symmetric with staging)

Making prod publicly reachable with the same `INGRESS_TRAFFIC_ALL`
+ `allUsers` binding as staging for the duration of the Sprint 3
exception window. Rejected: prod's attack surface during Batches
2–7 is not a placeholder container — the `gcloud run deploy` image
is explicitly prod-tagged, any unauthenticated invocation increments
prod's billing, and reputational cost of a prod-labelled URL being
abused is materially higher than staging's. The dev ergonomics gain
(one URL to test instead of two) does not justify the risk. Prod
goes public only in Batch 6 after Cloud Armor + Cloudflare are live.

## Consequences

### Positive

- `terraform.tfstate` is recoverable from bucket versioning for 90 days
  after any accidental deletion or corruption.
- `hashicorp/google ~> 7.0` gives us Cloud Run v2 fields and modern
  Discovery Engine types without provider-version-fence gymnastics.
- Env split + prefix-in-shared-bucket means Batch 3 staging apply
  does not touch prod state. The blast radius of `terraform apply`
  equals one env.
- Secret Manager naming convention is codified in both the variable
  validation (enforced) and this ADR (explanatory). Future secrets
  cannot drift silently.
- The bootstrap steps are in one place, reproducible, and include
  the exact commands a new operator would run.

### Negative / follow-up

- Staging is publicly reachable and unauthenticated for Batches 2–7.
  The mitigations in §Decision 6 are all mitigations, not zero-risk.
  A motivated attacker during the window can issue tool calls — they
  would only ever receive public immigration-bureau text, but the
  aggregated request log could reveal staging URL patterns. ADR
  tracking tag: `sprint-3-batch-8-close-staging-public`.
- Apply sequencing (staging before prod) is a human discipline, not
  enforced by Terraform. A prod-only `terraform plan` will succeed
  even if staging has been destroyed, but `terraform apply` will
  fail on the SA reference. This is caught by Batch 3's plan review,
  not by tooling.
- Prod's `runtime_sa_email` is hardcoded as a string in
  `envs/prod/variables.tf`. If the shared SA is renamed (not currently
  planned), the hardcoded string must be updated in lockstep.
- `hashicorp/google ~> 7.0` will eventually need a ~> 8.0 bump. The
  ADR tracking tag for that is `sprint-N-google-provider-8-bump`.
  There is no current trigger; google provider 8.0 is not yet
  announced.

## Verification performed (Batch 2 close)

- `terraform fmt -check -recursive infra/` — exit 0.
- `terraform validate` in both envs — exit 0.
- `terraform plan -out=plan.staging.tfplan` in `envs/staging/` —
  exit 0, diff size reported in the Batch 2 close message.
- `terraform plan -out=plan.prod.tfplan` in `envs/prod/` — exit 0,
  diff size reported.
- `pnpm run typecheck` — 9/9 tasks successful (no TypeScript
  surface touched in Batch 2).
- `pnpm exec biome check apps packages ui` — 0 infos / 5 warnings
  (unchanged from ADR-008).
- `pnpm -F @ssw/server test` — 60/60 passed.

## Related

- [ADR-005: ext-apps 1.7.0 evaluation](./ADR-005-ext-apps-1-7-0-evaluation.md)
  — previous anti-hallucination version-check precedent.
- [ADR-007: brand renaming](./ADR-007-brand-renaming.md) — established
  `ssw-compass-prod-494613` project id and `ssw-runtime` / `ssw-deploy`
  SA naming.
- [ADR-008: process.env index-access](./ADR-008-process-env-index-access.md)
  — co-kickoff-of-Sprint-3 ADR for the TypeScript side of Batch 1.
- [.cursor/rules/deployment-checklist.mdc](../../.cursor/rules/deployment-checklist.mdc)
  — operator-facing deploy runbook; this ADR is the design record.
- [docs/sprint-3-pending.md](../sprint-3-pending.md) — remaining
  Sprint 3 work; Batch 2 does not modify this file because the
  Batch 2 deliverables are infrastructure, not the TypeScript debt
  that file tracks.

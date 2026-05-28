# SSW Compass — developer onboarding

This doc covers per-developer local setup beyond `pnpm install`.
It targets macOS (Sprint 3 team is all on Apple silicon); Linux
equivalents are noted where they differ. Windows is not supported
as a primary dev host for Sprint 3.

## Prerequisites

| Tool | Minimum | Why |
|---|---|---|
| Node.js | 22 LTS | `package.json` engines pin + CI matrix |
| pnpm | 10 | workspace manager |
| `gcloud` CLI | any recent (≥ 480) | Terraform auth, GCS bootstrap, Cloud Run ops |
| Terraform | 1.14 | `infra/terraform/versions.tf` constraint |
| `cloudflared` | any | Sprint 1–3 tunnel for Claude Desktop local dev |
| `direnv` | ≥ 2.33 | **required** — see §GCP auth below |

Installation on macOS (Homebrew):

```bash
brew install node pnpm terraform cloudflared direnv
brew install --cask google-cloud-sdk  # or: curl https://sdk.cloud.google.com | bash
```

## GCP authentication via direnv

Sprint 3 introduces a project-scoped env via `.envrc` at the repo
root. This prevents the AIOS repo's `GOOGLE_APPLICATION_CREDENTIALS`
(pointing at a service-account key for a different project) from
leaking into `terraform plan` runs and causing `403 storage.objects.list`
failures against the SSW state bucket.

One-time setup:

```bash
# 1. Add the direnv hook to your shell (zsh example — bash users use bashrc).
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
exec zsh  # reload the shell

# 2. Authenticate gcloud as your @sugu-kuru.co.jp user.
gcloud auth login
gcloud auth application-default login  # for provider fallback auth

# 3. Allow the project's .envrc (one-time per repo clone).
cd ~/ssw-compass
direnv allow
```

Verification:

```bash
# Should print: ssw-compass-prod-494613
echo "$CLOUDSDK_CORE_PROJECT"

# Should print a non-empty token (260ish chars).
echo "${#GOOGLE_OAUTH_ACCESS_TOKEN} chars"

# Should print nothing (unset by .envrc).
echo "${GOOGLE_APPLICATION_CREDENTIALS:-<unset>}"
```

### Token refresh

`GOOGLE_OAUTH_ACCESS_TOKEN` is minted from `gcloud auth
print-access-token` and expires in ~1 hour. For long-running sessions:

```bash
# Refresh by leaving and re-entering the directory:
cd .. && cd -

# Or equivalently:
direnv reload
```

If Terraform reports `oauth2: "invalid_grant"` errors mid-apply,
assume token expiry and run one of the above.

## Terraform workflow (Sprint 3 Batch 2 onward)

See [ADR-009](adr/ADR-009-terraform-foundation.md) for design.
Runbook:

```bash
cd infra/terraform/envs/staging
terraform init     # downloads hashicorp/google provider, reads GCS backend
terraform plan -out=plan.staging.tfplan
# human reviews plan diff
terraform apply plan.staging.tfplan  # Batch 3 only; Batch 2 stops at plan

# Then prod (after staging apply succeeds):
cd ../prod
terraform init
terraform plan -out=plan.prod.tfplan
terraform apply plan.prod.tfplan
```

`plan.*.tfplan` files are `*.tfplan` git-ignored per `.gitignore`;
never commit them. `terraform.tfvars` files contain **non-secret**
project IDs and are force-included via the `!infra/terraform/envs/*/terraform.tfvars`
.gitignore negation.

## GitHub Actions secrets (one-time, first operator only)

For the CI/CD flow in `.github/workflows/` to authenticate to GCP,
four repository secrets must be registered. See
[docs/deploy-runbook.md](deploy-runbook.md#1-github-secrets-registration)
for the exact values and the UI path.

Subsequent developers who clone the repo do not need to re-register
these — they are repository-scoped and already set by the Batch 3
operator.

## Pro JWT issuance (Sprint 4 / ADR-013)

SSW Compass uses HS256 application-layer JWTs for Pro tier access
until the Sprint 5 OAuth authorization server replaces manual issuance.

Prerequisites:

- `gcloud auth login` as an operator who can access Secret Manager in
  `ssw-compass-prod-494613`.
- Secret Manager secret `ssw-jwt-secret` exists and contains the HS256
  signing secret.

Issue a 90-day Pro token for J-VAG:

```bash
pnpm tsx scripts/issue-jwt.ts \
  --sub jvag-gateway \
  --tier pro \
  --gyoseishoshi-verified \
  --gyoseishoshi-number "東京都 12345" \
  --expires 90d
```

The script prints only the JWT to stdout. Store that value in 1Password
as `ssw-compass-prod-jwt-token`; do not commit it or paste it into logs.

## Claude Desktop / Cursor / other MCP host setup

See `.claude/desktop_config.example.json` and the `README.md`
Quick start section. Those flows do not change in Sprint 3; only
the backing server URL becomes `https://ssw-mcp-staging-*.run.app`
instead of `https://*.trycloudflare.com` once Batch 3 ships.

## Not in scope for this doc

- Writing new MCP tools — covered in `docs/specs/v3-supplement.md`.
- Vertex AI Search data ingestion — covered in Batch 4 follow-up docs.
- Deploy-on-push setup — covered in `.github/workflows/` comments
  once Batch 3 lands GitHub Actions.

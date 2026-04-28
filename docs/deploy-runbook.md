# SSW Compass — deploy runbook (Sprint 3 Batch 3 onward)

Operator-facing procedures for Cloud Run deployment, branch
protection, and incident response. Complements
[ADR-009](adr/ADR-009-terraform-foundation.md) (design record) and
[.cursor/rules/deployment-checklist.mdc](../.cursor/rules/deployment-checklist.mdc)
(Sprint 1-era cheatsheet).

## One-time setup (Batch 3)

### 1. GitHub Secrets registration

After `terraform apply` in `envs/staging/` finishes, capture its
outputs and register the following as repository-level secrets at
`https://github.com/sugukurukabe/ssw-compass/settings/secrets/actions`:

| Secret name | Value (from `terraform output`) | Type |
|---|---|---|
| `WIF_PROVIDER` | `wif_provider_name` output | string |
| `DEPLOY_SA_EMAIL` | `deploy_sa_email` output | string |
| `PROJECT_ID` | `ssw-compass-prod-494613` | string (constant) |
| `AR_REPO_URL` | `artifact_registry_url` output | string |

None of these are actual secrets in the cryptographic sense —
they are public infrastructure identifiers. We store them in GitHub
Secrets (rather than workflow `env:`) only to decouple workflows
from values that may eventually change (project migration,
WIF pool rotation).

Command reference to re-read outputs later:

```bash
cd infra/terraform/envs/staging
terraform output -raw wif_provider_name
terraform output -raw deploy_sa_email
terraform output -raw artifact_registry_url
```

### 2. Branch protection (main)

Branch protection is set up **manually via the GitHub UI** because
GitHub's API for rulesets requires Owner permission and the repo
admin (@kabe) retains exclusive control of this setting per team
Git rules.

Navigate to: `https://github.com/sugukurukabe/ssw-compass/settings/branches`

Click **Add branch protection rule** (or edit an existing one for
`main`) and set:

- **Branch name pattern**: `main`
- **Require a pull request before merging**: ✓
  - Required approvals: **1**
  - Dismiss stale pull request approvals when new commits are pushed: ✓
  - Require approval of the most recent reviewable push: ✓
- **Require status checks to pass before merging**: ✓
  - Require branches to be up to date before merging: ✓
  - Required checks (search and add each):
    - `Lint + typecheck + test` (from `ci.yml` job name)
    - `Terraform fmt + validate` (from `ci.yml` job name)
- **Require conversation resolution before merging**: ✓
- **Do not allow bypassing the above settings**: ✓ (no admin bypass)
- **Restrict who can push to matching branches**: leave unchecked
  (the above rules already make direct push impossible)
- **Allow force pushes**: OFF
- **Allow deletions**: OFF

Click **Create** / **Save changes**.

After saving, a manual `git push origin main` from the terminal
should fail with `remote: Branch protection rule violations`.
Confirm this before proceeding — it is the positive signal that
the configuration is in effect.

### 3. First deployment (after Secrets + protection are set)

1. Create a feature branch: `git checkout -b feat/sprint-3-batch-3-ci-cd`
2. Push: `git push -u origin feat/sprint-3-batch-3-ci-cd`
3. Open a PR via `gh pr create` or the GitHub UI; target `main`.
4. PR checks auto-run (`ci.yml`). All green = ready to merge.
5. Merge the PR (squash or merge-commit).
6. On merge, `cd-staging.yml` auto-fires against the new `main`.
7. Monitor the workflow at
   `https://github.com/sugukurukabe/ssw-compass/actions`.
8. On smoke-test success, staging is live with the new revision.

## Operational procedures

### Deploy failure response (staging)

When you receive a GitHub Actions failure email for `cd-staging.yml`:

1. Check the failed job in the Actions tab. Common patterns:
   - `terraform-apply-staging` failed → infra issue (if re-introduced
     as part of a future workflow; `cd-staging.yml` in Batch 3 does
     not apply Terraform, so this job name would not appear today).
   - `smoke-test` failed → app issue; check Cloud Logging for the
     failing request (search `resource.labels.service_name="ssw-mcp-staging"`
     and timeframe covering the `deploy` job completion).
   - `build-push` failed → Dockerfile or AR auth issue. Authentication
     failures typically mean `WIF_PROVIDER` or `DEPLOY_SA_EMAIL`
     secrets are wrong; verify against
     `terraform output -raw wif_provider_name` / `deploy_sa_email`.
2. The workflow auto-runs `revert-on-failure` which routes traffic
   back to the previous revision. First-deploy failures have no
   previous revision — the failed revision stays at 0 % traffic and
   the service effectively serves nothing until a new deploy
   succeeds.
3. Decide: rollback further, or push a fix?
   - **Rollback further**:
     ```bash
     gcloud run services update-traffic ssw-mcp-staging \
       --region=asia-northeast1 \
       --to-revisions=<older-rev>=100
     ```
     List candidates with `gcloud run revisions list --service=ssw-mcp-staging --region=asia-northeast1`.
   - **Fix**: open a PR with the fix. CI/CD will redeploy on merge.
4. If the failure left orphan resources (e.g., half-built AR image,
   broken IAM binding from a failed future batch), run
   `terraform plan` locally in `envs/staging/` and check for
   unexpected diffs. If a diff appears and explains the failure,
   investigate before applying.
5. Update `docs/sprint-3-pending.md` with any new operational
   concern surfaced by the incident — future batches can track and
   resolve.

### Hotfix path

Even in a genuine emergency, Sprint 3 policy requires going through
a PR. The branch protection rule has no admin bypass and no
"emergency override" toggle. The PR can be approved and merged in
under 60 seconds if a reviewer is online; if no reviewer is
reachable:

1. **If the issue is localised to staging**: use ADR-009
   §Decision 6 mitigation #4 to immediately stop all traffic:
   ```bash
   gcloud run services delete ssw-mcp-staging \
     --region=asia-northeast1 \
     --project=ssw-compass-prod-494613 \
     --quiet
   ```
   This removes the service entirely. Traffic stops. Billing stops.
   The service is recreated on the next successful `terraform apply`
   in `envs/staging/` + `cd-staging.yml` run.
2. **If the issue is prod**: prod has no public-facing exposure
   during Batch 3–5 (`INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`). There
   is no hotfix window to compress. File an issue and follow the
   normal PR flow; if the worst case is "prod gets its first deploy
   delayed by a day", that is acceptable.
3. **Communicate**: post to the team Slack channel that the staging
   delete was done and why. The service will come back on the next
   successful CD run.

### Rollback (non-emergency)

```bash
# List recent revisions, ordered newest-first:
gcloud run revisions list \
  --service=ssw-mcp-staging \
  --region=asia-northeast1 \
  --limit=10

# Route 100 % traffic back to a specific revision:
gcloud run services update-traffic ssw-mcp-staging \
  --region=asia-northeast1 \
  --to-revisions=ssw-mcp-staging-NNNNN-xyz=100

# Verify:
gcloud run services describe ssw-mcp-staging \
  --region=asia-northeast1 \
  --format='value(status.traffic)'
```

### Staging URL discipline (ADR-012, supersedes ADR-009 §Decision 6 mitigation #1)

Sprint 3 Batch 6 closed the ADR-009 public-exception window; staging
is now `allow_unauthenticated=false`. The URL-leak grep rule
continues under [ADR-012](adr/ADR-012-egress-and-public-exposure.md)
§Ongoing guards as an operational practice (reduces accidental
sharing, simplifies rotation during incidents):

```bash
git grep -iE 'ssw-mcp-(staging|prod)-[a-z0-9]+[-.][a-z0-9-]+\.(a\.)?run\.app' \
  -- ':!docs/adr/*' ':!data/url-health-report*'
```

Expected output: zero matches. Run before every batch commit.
Discovery of a leak is a security finding → rotate the Cloud Run
service (destroy + recreate via Terraform) so the public URL changes.

## Smoke test (manual re-run, ADR-012 ID-token flow)

Staging requires a Bearer ID token per ADR-012 §Decision 2.

```bash
SERVICE_URL=$(gcloud run services describe ssw-mcp-staging \
  --region=asia-northeast1 --format='value(status.url)')

# Mint an ID token bound to the Cloud Run service audience
TOKEN=$(gcloud auth print-identity-token --audiences="$SERVICE_URL")

# 1. HTTP health
curl -fsS -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/health" \
  | jq -e '.status == "ok" and .service == "ssw-mcp"'

# 2. MCP tools/list (expect 5 tools: search_visa, classify_procedure,
#    get_deadline_timeline, list_visa_documents, _ssw_checklist_schema)
INIT_RESP=$(curl -sS -i -X POST "$SERVICE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"manual","version":"1"},"capabilities":{}}}')
SESSION_ID=$(echo "$INIT_RESP" | grep -i '^mcp-session-id:' | awk '{print $2}' | tr -d '\r\n')

curl -sS -X POST "$SERVICE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | awk '/^data: /{sub(/^data: /,""); print; exit}' \
  | jq -e '.result.tools | length == 5'

# 3. tools/call search_visa (expect results >= 2)
curl -sS -X POST "$SERVICE_URL/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_visa","arguments":{"query":"特定技能1号 建設分野","lang":"ja","category":"tokutei_ginou_1"}}}' \
  | awk '/^data: /{sub(/^data: /,""); print; exit}' \
  | jq -e '.result.structuredContent.results | length >= 2'

# 4. Server Card
curl -fsS -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/.well-known/mcp.json" \
  | jq -e '.name == "SSW Compass"'

# 5. Confirm un-authenticated access is blocked (ADR-012 §Decision 2)
curl -s -o /dev/null -w '%{http_code}\n' "$SERVICE_URL/health"
# Expected: 401
```

## See also

- [ADR-009: Terraform foundation](adr/ADR-009-terraform-foundation.md)
- [docs/onboarding.md](onboarding.md) — developer setup (direnv etc.)
- [.cursor/rules/deployment-checklist.mdc](../.cursor/rules/deployment-checklist.mdc)
  — Sprint 1 cheat-sheet (kept for historical reference; this
  document supersedes it for Sprint 3+)

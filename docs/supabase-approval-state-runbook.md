# Supabase Approval State Runbook

## Purpose

SSW Compass uses Supabase only for operational HITL approval state:

- `drafts`
- `approval_requests`

The audit archive remains Cloud Logging exported to GCS WORM storage.

## Provisioning

### Supabase プロジェクト

```sh
# 1. CLI でプロジェクト作成 (org-id は sugukuru org)
DBPASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-28)"
supabase projects create ssw-compass \
  --org-id mcdjckozyihfzudqkvlh \
  --db-password "$DBPASS" \
  --region ap-northeast-1 \
  --output json --yes

# 2. リポジトリにリンク (IPv4 プーラーを取得)
supabase link --project-ref <ref>
supabase link --project-ref <ref>   # 2回目: ACTIVE 後に再リンクで pooler-url 更新

# 3. migration 適用 (IPv4 プーラー経由)
PGURL="postgresql://postgres.<ref>:<DBPASS>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
supabase db push --db-url "$PGURL"
```

### 現在のプロジェクト情報 (2026-06-13 作成済み)

- **Ref**: `tavgxajamuomqjzjrwcv`
- **Region**: `ap-northeast-1` (Northeast Asia / Tokyo)
- **URL**: `https://tavgxajamuomqjzjrwcv.supabase.co`
- **Supabase ダッシュボード**: https://supabase.com/dashboard/project/tavgxajamuomqjzjrwcv

### Secret Manager (prod GCP プロジェクト: ssw-compass-prod-494613)

シークレットは作成・注入済み。再作成が必要な場合:

```sh
PROJECT="ssw-compass-prod-494613"
REGION="asia-northeast1"

# シークレット作成 (org ポリシーで user-managed replication が必須)
gcloud secrets create ssw-supabase-url \
  --project="$PROJECT" \
  --replication-policy=user-managed \
  --locations="$REGION" \
  --labels="env=prod,owner=ssw-compass,managed-by=manual"

gcloud secrets create ssw-supabase-service-role-key \
  --project="$PROJECT" \
  --replication-policy=user-managed \
  --locations="$REGION" \
  --labels="env=prod,owner=ssw-compass,managed-by=manual"

# バージョン追加
printf '%s' "https://<ref>.supabase.co" | \
  gcloud secrets versions add ssw-supabase-url --project="$PROJECT" --data-file=-
printf '%s' "<service_role_key>" | \
  gcloud secrets versions add ssw-supabase-service-role-key --project="$PROJECT" --data-file=-

# runtime SA にアクセス権付与
SA="ssw-runtime@ssw-compass-prod-494613.iam.gserviceaccount.com"
for SECRET in ssw-supabase-url ssw-supabase-service-role-key; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --project="$PROJECT" \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done

# Cloud Run への注入は infra/terraform/envs/prod/main.tf の secret_env_vars で管理
# terraform apply -target=module.cloud_run
```

### Cloud Run 注入済み環境変数

| 環境変数 | ソース | 備考 |
|---------|--------|------|
| `SUPABASE_URL` | Secret Manager: `ssw-supabase-url` | MRTR 承認フロー用 |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret Manager: `ssw-supabase-service-role-key` | サーバー専用。UI 非公開 |
| `PACKAGE_ARTIFACT_BUCKET` | plain env var: `ssw-compass-packages-prod` | GCS バケット名（未作成） |

## Verification

After applying migrations:

1. Confirm RLS is enabled on `public.drafts` and `public.approval_requests`.
2. Confirm `anon`, `authenticated`, and `public` have no table privileges.
3. Confirm `service_role` can insert and update rows.
4. Confirm an update with `status = 'pending'` succeeds once and returns zero
   rows on replay.

## Data Rules

- Do not store names, residence card numbers, passport numbers, My Number, or
  full dates of birth.
- Store generated document bodies in GCS only.
- Use `sha256:` hashes for TOCTOU checks.
- Treat `approval_requests.id` as the only `requestState` value.

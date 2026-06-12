# Supabase Approval State Runbook

## Purpose

SSW Compass uses Supabase only for operational HITL approval state:

- `drafts`
- `approval_requests`

The audit archive remains Cloud Logging exported to GCS WORM storage.

## Provisioning

1. Create a dedicated SSW Compass Supabase project.
2. Select the Tokyo region where available.
3. Apply migrations in `supabase/migrations/` in numeric order.
4. Store the service role key in Secret Manager or the Cloud Run deployment
   environment. Do not expose it to UI resources or clients.

Required environment variables:

```sh
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

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

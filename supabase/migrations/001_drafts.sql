-- SSW Compass approval state store.
-- Stores only draft metadata and hashes; generated document bodies remain in GCS.
-- PII, residence card numbers, passport numbers, and individual numbers are not stored here.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  case_handle text not null,
  sha256 text not null check (sha256 ~ '^sha256:[a-f0-9]{64}$'),
  storage_uri text,
  status text not null default 'active' check (status in ('active', 'superseded', 'expired', 'deleted')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.drafts is
  'SSW Compass draft metadata only. Draft bodies are stored in GCS and expire after 24 hours.';
comment on column public.drafts.case_handle is
  'Opaque case handle such as SAMPLE-CASE-0001; personal identifiers are not accepted.';
comment on column public.drafts.sha256 is
  'Server-calculated sha256 hash used for TOCTOU checks.';
comment on column public.drafts.storage_uri is
  'GCS object URI for generated artifacts. Signed URLs are produced outside the database.';

create index drafts_case_handle_idx on public.drafts (case_handle);
create index drafts_expires_at_idx on public.drafts (expires_at);

create trigger drafts_set_updated_at
before update on public.drafts
for each row
execute function public.set_updated_at();

alter table public.drafts enable row level security;

revoke all on table public.drafts from anon, authenticated, public;
grant select, insert, update, delete on table public.drafts to service_role;

create policy "Service role manages drafts"
on public.drafts
as permissive
for all
to service_role
using (true)
with check (true);

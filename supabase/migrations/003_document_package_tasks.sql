-- SSW Compass document package task metadata.
-- Artifact bodies are stored in GCS and expire via lifecycle management.
-- This table stores no personal identifiers.

create table public.document_package_tasks (
  id text primary key check (id ~ '^task_[A-Za-z0-9_-]{22}$'),
  case_handle text not null,
  idempotency_key text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  result_uri text,
  error_message text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.document_package_tasks is
  'SSW Compass document package task metadata. Artifact bodies remain in GCS.';

create unique index document_package_tasks_idempotency_key_idx
  on public.document_package_tasks (idempotency_key);
create index document_package_tasks_case_handle_idx on public.document_package_tasks (case_handle);
create index document_package_tasks_status_expires_idx
  on public.document_package_tasks (status, expires_at);

create trigger document_package_tasks_set_updated_at
before update on public.document_package_tasks
for each row
execute function public.set_updated_at();

alter table public.document_package_tasks enable row level security;

revoke all on table public.document_package_tasks from anon, authenticated, public;
grant select, insert, update, delete on table public.document_package_tasks to service_role;

create policy "Service role manages document package tasks"
on public.document_package_tasks
as permissive
for all
to service_role
using (true)
with check (true);

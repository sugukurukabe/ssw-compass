-- SSW Compass multi-round-trip approval state.
-- requestState is the opaque approval_requests.id value; it contains no PII.
-- All state transitions are performed by application-level CAS updates.

create table public.approval_requests (
  id text primary key check (id ~ '^ars_[A-Za-z0-9_-]{22}$'),
  draft_id uuid not null references public.drafts(id),
  draft_sha256 text not null check (draft_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  principal text not null,
  step text not null check (step in ('staff_review', 'gyoseishoshi_approval', 'final_execute')),
  parent_id text references public.approval_requests(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'executed', 'rejected', 'expired', 'escalated')),
  idempotency_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  trace_id text
);

comment on table public.approval_requests is
  'Opaque HITL approval state for SSW Compass. The id is echoed as requestState.';
comment on column public.approval_requests.principal is
  'Opaque actor identifier or hashed principal; personal identifiers are not accepted.';
comment on column public.approval_requests.idempotency_key is
  'Executor idempotency key. Reuse for the same logical operation only.';

create unique index approval_requests_idempotency_key_idx
  on public.approval_requests (idempotency_key);
create index approval_requests_draft_id_idx on public.approval_requests (draft_id);
create index approval_requests_parent_id_idx on public.approval_requests (parent_id);
create index approval_requests_status_expires_idx on public.approval_requests (status, expires_at);

create trigger approval_requests_set_updated_at
before update on public.approval_requests
for each row
execute function public.set_updated_at();

alter table public.approval_requests enable row level security;

revoke all on table public.approval_requests from anon, authenticated, public;
grant select, insert, update, delete on table public.approval_requests to service_role;

create policy "Service role manages approval requests"
on public.approval_requests
as permissive
for all
to service_role
using (true)
with check (true);

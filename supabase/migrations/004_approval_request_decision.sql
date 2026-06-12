-- approval_requests に解決時の判断種別を保存し、編集ループ判定を status から分離する。
-- Store the resolving decision on approval_requests so edit-loop detection is separate from status.
-- Simpan jenis keputusan penyelesaian pada approval_requests agar deteksi loop edit terpisah dari status.

alter table public.approval_requests
  add column decision text
    check (decision in ('approve', 'reject', 'edit', 'expire', 'execute'));

comment on column public.approval_requests.decision is
  'Decision that resolved the row; nullable for pending and pre-migration rows.';

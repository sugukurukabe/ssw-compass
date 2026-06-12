-- document_package_tasks の冪等キーを principal 単位にスコープする。
-- Scope document_package_tasks idempotency keys per principal.
-- Membatasi kunci idempotensi document_package_tasks per principal.
--
-- 背景 / Background / Latar belakang:
-- prepare_document_package は GCS 上で `sha256(authSubject \0 idempotency_key)` 単位で
-- 冪等性を管理する。migration 003 のテーブル全体 unique(idempotency_key) はこのモデルと
-- 矛盾し、異なる principal が同じクライアント側キーを再利用すると衝突する。principal 列を
-- 追加し (principal, idempotency_key) の複合 unique に置き換えて GCS スコープと一致させる。
--
-- prepare_document_package scopes idempotency in GCS by `sha256(authSubject \0 idempotency_key)`.
-- The table-wide unique(idempotency_key) from migration 003 contradicts that model: two distinct
-- principals reusing the same client key would collide. Add a principal column and replace the
-- index with a composite unique on (principal, idempotency_key) to match the GCS scope.
--
-- Catatan: tabel ini belum dipakai kode; perubahan aman karena tidak ada baris produksi.

alter table public.document_package_tasks
  add column principal text;

comment on column public.document_package_tasks.principal is
  'Opaque per-caller principal (sha256 of user id). Idempotency is scoped per principal, matching the GCS artifact layout. No personal identifiers.';

drop index if exists document_package_tasks_idempotency_key_idx;

create unique index document_package_tasks_principal_idempotency_key_idx
  on public.document_package_tasks (principal, idempotency_key);

# Proposal: Update Read-Only Tool Rule for HITL Workflows

## Background

The workspace rule currently says every SSW Compass MCP tool must be read-only.
SSW Compass v2.1 introduces explicit HITL approval and document package
workflows. These workflows require operational writes to `approval_requests`,
`drafts`, GCS task artifacts, and audit logs.

The legal and privacy boundary remains unchanged:

- No personal identifiers are accepted.
- Generated documents are drafts for human/professional review.
- Legal advice is not provided.
- Audit logs remain Cloud Logging → GCS WORM per ADR-015.

## Proposed Rule Change

Replace the absolute read-only rule with:

> Public L0/L1 information tools remain read-only and must keep
> `readOnlyHint: true`.
>
> L2/L3 HITL tools may write operational state only when all of the following
> are true:
>
> - tool annotations set `readOnlyHint: false` and `destructiveHint: false`
> - access is guarded by auth scope and HITL controls
> - the write stores no personal identifiers
> - the write is idempotent or CAS-protected
> - audit evidence is emitted before returning success
> - generated document bodies are stored ephemerally and expire automatically

## Affected v2.1 Tools

- `submit_gyoseishoshi_approval`
- `prepare_document_package`
- `get_package_status`
- rc-only `tasks/get`, `tasks/update`, `tasks/cancel`

## Status: Applied (2026-06-13)

Approved via ADR-024 and applied to `.cursor/rules/00-global-context.mdc`
constraint #3, which now permits the L2 HITL write tools
(`submit_gyoseishoshi_approval`, `prepare_document_package`) under the listed
guards while keeping all public L0/L1 tools read-only.

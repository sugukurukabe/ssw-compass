# SSW Compass Tool Inventory (Submission Review)

> **Updated**: 2026-04-29
> **Purpose**: Directory reviewer reference for tool names, annotations, read/write classification, auth, and data returned.

| Tool | Public? | Read/write | Auth | Legal level | Data returned | Notes |
|---|---|---|---|---|---|---|
| `search_visa` | Yes | Read-only | Free anonymous | L0 | Search results, source URLs, disclaimer | General information only; no PII accepted |
| `classify_procedure` | Yes | Read-only | Free anonymous | L1 | Procedure type, reasons, disclaimer | Classification only; no filing |
| `get_deadline_timeline` | Yes | Read-only | Free anonymous | L1 | Deadline entries, references, disclaimer | Free tier 3-case limit |
| `list_visa_documents` | Yes | Read-only for `json/html_preview`; write-like gated for `pdf_draft/csv` | Free for json/html, Pro+gyoseishoshi for pdf/csv | L1→L2 per-call escalation | Document checklist, optional preview flags | Actual PDF/CSV generation is Sprint 5 |
| `list_law_updates` | Yes | Read-only | Free anonymous | L0 | Law update fixture entries, source URLs, disclaimer | Fixture data from primary sources |
| `validate_zairyu_compatibility` | Yes | Read-only | Free anonymous | L1 | Compatibility result, legal basis, recommendation | H06 illegal-work alert; information only |
| `submit_gyoseishoshi_approval` | Yes, but Pro-only | Write-like audit event | Pro + gyoseishoshi_verified JWT | L2 | Approval result, audit event recorded flag | Anonymous users are blocked by H01 lockgate |
| `_ssw_checklist_schema` | Removed from public registration | — | — | Internal | UI column order | Removed from `createMcpServer()` before directory submission to avoid exposing internal helper |

## Review notes

- All tools include `readOnlyHint` or `destructiveHint` annotations.
- All public Free tools are side-effect-free.
- `submit_gyoseishoshi_approval` writes an audit event and is intentionally Pro-only; it must not be presented as a general Free tool.
- `_ssw_checklist_schema` was removed from public registration before final submission readiness work. This avoids exposing internal UI helper tools to directory reviewers.

## Data minimization

- Tool responses never return raw user identifiers.
- Audit logs store hashes (`input_hash`, `output_hash`) only.
- PII inputs are blocked before retrieval.

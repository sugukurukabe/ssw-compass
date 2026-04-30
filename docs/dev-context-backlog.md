# Developer Context Backlog

GitHub issues, pull requests, release notes, and internal roadmap material are
valuable for engineering agents, but they are not part of the public SSW
Compass visa connector.

## Decision

Defer GitHub/dev-context ingestion to Sprint 7+ and implement it as a separate
private connector or admin-only MCP server.

## Reasons

- SSW Compass is public, read-only, anonymous, and visa-procedure focused.
- Developer context may contain internal implementation details that are not
  appropriate for a public connector.
- Mixing dev context with visa procedure sources would weaken relevance and
  complicate Anthropic/OpenAI submission review.
- Separate data stores allow different auth, retention, and tool descriptions.

## Future shape

```text
GitHub webhook -> Cloud Run dev-context-sync -> GCS dev_context bucket
  -> Agent Search dev_context_v2 -> private ssw-dev-mcp
```

Candidate tools:

- `search_documents`
- `get_documents`
- `answer_query`

All tools must be private or authenticated. They must not be exposed in the
public SSW Compass connector.


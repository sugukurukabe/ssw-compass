# OAuth Follow-up Plan / OAuth 後続対応計画

This document records the future OAuth 2.0 plan for Pro tool exposure. It does not change the current public submission posture: six read-only tools are anonymous, and Pro tools remain contractual and gated.

## Goals

- Keep the public connector submission `auth.type: none` for anonymous read-only use.
- Add OAuth only for Pro workflows after provider review and contractual onboarding.
- Expose Pro tools only after a valid Pro authorization context is present.

## Target Flow

1. Use OAuth 2.0 Authorization Code with PKCE S256 for user-facing Pro login.
2. Use a dedicated authorization server or IdP controlled by Sugukuru Inc.
3. Require Pro contract status and gyoseishoshi verification before issuing Pro claims.
4. Include a resource indicator for `https://mcp.ssw-compass.jp/mcp`.
5. Return to the Claude callback URL when Claude initiates auth:
   `https://claude.ai/api/mcp/auth_callback`
6. Issue access tokens with least-privilege scopes:
   - `compass:read`
   - `compass:draft`
   - `compass:approve`
   - `compass:execute`
7. Continue enforcing HITL gates inside tool handlers even when OAuth succeeds.

## Protected Resource Metadata

Add RFC 9728 OAuth Protected Resource Metadata before public Pro OAuth launch:

- Resource URL: `https://mcp.ssw-compass.jp/mcp`
- Metadata endpoint: `https://mcp.ssw-compass.jp/.well-known/oauth-protected-resource`
- Authorization servers: the Sugukuru-controlled issuer URL
- Supported scopes: `compass:read`, `compass:draft`, `compass:approve`, `compass:execute`
- Documentation: link to `/privacy` and `/pro`

## Reviewer Test Account Path

For Pro review, create a non-production reviewer tenant with no personal identifiers:

1. Contract flag: Pro enabled.
2. Gyoseishoshi verification: synthetic reviewer status, not a real person's certificate data.
3. Token claims: `tier: pro`, `gyoseishoshi_verified: true`, issuer and audience checks enabled.
4. Reviewer note: Pro tools are visible only after this login path; anonymous review sees six read-only tools.

## Open Questions Before Implementation

- Final IdP choice and issuer URL.
- Token lifetime and refresh-token policy.
- Whether OpenAI and Anthropic require separate OAuth client registrations.
- Exact reviewer account delivery path for each portal.
- Independent Terms of Service URL if required by the OAuth review flow.

## Acceptance Criteria

- PKCE S256 is mandatory for browser-based authorization.
- `/.well-known/oauth-protected-resource` validates against RFC 9728 expectations.
- `tools/list` remains request-aware: anonymous returns 6 read-only tools; authenticated Pro returns the 3 additional Pro tools.
- Pro tool execution continues to require scope checks and HITL evidence.
- No PII is stored in reviewer tokens, logs, or audit fixtures.

# ADR-013: Authentication strategy — Path Y (application-layer JWT)

- **Status**: Accepted
- **Date**: 2026-04-28 (Sprint 4, Batch 2)
- **Deciders**: 壁 (Sugukuru K.K. CEO), Cursor Agent
- **Scope**: `apps/server/src/auth/`, `infra/terraform/envs/*/main.tf`,
  Cloud Run ingress policy (ADR-012 §Follow-up)

---

## Context

Sprint 4 Batch 1 pre-flight (docs/batch-1-preflight-report.md §2) confirmed
that `@modelcontextprotocol/sdk@1.29.0` exports no auth primitives — the
`server/auth/` path resolves to an empty module with zero exports.
`1.30.x` is not yet released. Consequently, Path X (SDK-native TokenVerifier)
is unavailable for Sprint 4.

Three paths were evaluated (sprint-4-plan.md §3.1):

| Path | Description | SDK dependency |
|---|---|---|
| X | SDK TokenVerifier (RFC 8707 Resource Indicator) | ≥ 1.30 (unavailable) |
| Y | Application-layer JWT self-verify (Express middleware) | none |
| Z | OAuth 2.1 Client Credentials + `"free_public"` scope | none |

### Cloud Run ingress (C2 from Batch 1)

ADR-012 set `allow_unauthenticated = false` for staging and prod.
v4 §8.2 states "Free (anonymous) continues from v3". The conflict is resolved
by clarifying the layering:

- **Cloud Run layer**: requests require a Google Identity token (IAM-gated).
  This token is issued by the caller host (Claude Desktop, Claude Web, etc.)
  using the standard `Authorization: Bearer <id_token>` header that
  Cloud Run enforces before any app code runs.
- **Application layer**: SSW interprets the *MCP Bearer token* (separate
  from the Cloud Run identity token) to decide Free vs Pro tier.
  No MCP auth token = Free anonymous tier.

ADR-012 is **unchanged** — Cloud Run remains auth-gated via IAM.
The "anonymous Free" in v4 §8.3 means *no MCP-level token*, not
*no Cloud Run identity token*.

---

## Decision

**Adopt Path Y: application-layer JWT self-verify.**

JWT secret is stored in Secret Manager (`ssw-jwt-secret`), mounted to
Cloud Run via volume mount (env-from-secret pattern, ADR-009). The server
validates HS256 JWTs on the `Authorization: Bearer <token>` header of
incoming MCP requests. No MCP Bearer token = Free anonymous AuthContext.

---

## Rationale

### Why not Path Z (OAuth Client Credentials + "free_public" scope)?

- **Complexity**: requires an authorization server endpoint (`/token`),
  client registration, scope validation — a full OAuth AS implementation
  doubles Batch 2 scope without business necessity in Sprint 4.
- **Host compatibility risk**: Claude Desktop / Claude Web / VS Code Copilot
  each handle OAuth differently. Path Y issues tokens out-of-band (dashboard
  copy-paste for Sprint 4), which works universally.
- **Sprint 5 upgrade path**: Path Y JWTs can be issued by an OAuth AS in
  Sprint 5 without changing the server-side validation code. The `auth_source`
  claim records how the token was issued.

### Why not Path X (SDK TokenVerifier)?

Unavailable — SDK 1.29.0 has no auth exports. Monitor `1.30.x` releases
and supersede this ADR if SDK-native auth becomes practical.

### Path Y token lifecycle (Sprint 4)

```
Sprint 4:  壁 (admin) → signs HS256 JWT with Secret Manager key
           → pastes token into Claude Desktop / Web config
           JWT claims: { sub, tier, gyoseishoshi_verified, auth_source: "jwt" }

Sprint 5+: OAuth AS issues tokens, same JWT format, auth_source: "oauth"
           Path Y server code unchanged
```

---

## Implementation

### Secret Manager

New secret: `ssw-jwt-secret` (env `shared`).
Value set manually via `gcloud secrets versions add` (not Terraform-managed
value — key rotation is operational, not IaC-managed).
Cloud Run accesses via volume-mounted secret, env var name `SSW_JWT_SECRET`.

### AuthContext shape (Interface Freeze — see §Consequences)

Defined in `packages/shared-types/src/auth/AuthContext.ts`.
**This shape is immutable for Sprint 4.** Changes require a new ADR.

```typescript
export const AuthContext = z.object({
  user_id:                z.string().min(1).max(128),
  tier:                   AuthTier,            // "free" | "pro" | "business"
  gyoseishoshi_verified:  z.boolean(),
  gyoseishoshi_number:    z.string().regex(/^[\u4e00-\u9fa5]+ \d+$/).optional(),
  auth_source:            z.enum(["anonymous", "jwt", "oauth_client_credentials"]),
  issued_at:              z.number().int().nonnegative(),
}).strict();
```

### Middleware behaviour

```
Request has no Bearer token
  → AuthContext{ user_id: "anonymous", tier: "free",
                 gyoseishoshi_verified: false,
                 auth_source: "anonymous", issued_at: 0 }

Request has valid HS256 Bearer token
  → AuthContext decoded from JWT claims

Request has malformed / expired / invalid-signature Bearer token
  → HTTP 401, no tool handler reached
```

Middleware is applied to `/mcp` POST only (not `/health` or
`/.well-known/mcp.json` which are public read-only endpoints).

### Free-tier tool access without MCP Bearer token

Cloud Run IAM still requires a Google identity token. In practice:

- **Claude Desktop**: configured with the Cloud Run service URL + ID token
  from `gcloud auth print-identity-token` in the connection config.
- **Claude Web (Custom Connector)**: connector itself holds the Cloud Run
  IAM credential; users are anonymous at the SSW layer.

---

## Alternatives rejected

### A. Path X — SDK TokenVerifier

See Context §SDK check. Unavailable at `^1.29.0`. ADR status will be
revisited when SDK 1.30.x ships.

### B. Path Z — OAuth Client Credentials + `free_public` scope

Full OAuth AS doubles Batch 2 scope. Rejected for Sprint 4; remains the
preferred Sprint 5 upgrade path.

### C. No auth at all (anonymous-only for Sprint 4)

Defers the Pro tier entirely to Sprint 5, reducing Batch 2 to zero code.
Rejected because Sprint 4 v4 §0 Goal requires Pro-tier H01 lockgate for
Killer feature #6 (`submit_gyoseishoshi_approval` — L2 tool). Without auth,
L2 always rejects or always permits.

### D. API-key (static token, no JWT structure)

Simpler than JWT but loses tier/claims expressivity needed for H01 gate
(need `tier` and `gyoseishoshi_verified` claims). JWT is minimal overhead.

---

## Consequences

### Interface Freeze (Sprint 4 — do not change without new ADR)

The following are frozen for the remainder of Sprint 4:
- `AuthContext` zod shape (user_id, tier, gyoseishoshi_verified,
  gyoseishoshi_number?, auth_source, issued_at)
- `AuthTier` enum: `"free" | "pro" | "business"`
- `SswCompassTokenVerifier.verify(token: string | null): Promise<AuthContext | null>`
- `resolveAuthContext(req)` signature
- JWT algorithm: HS256 (upgrade to RS256 in Sprint 5 with OAuth AS)

### Cloud Run ingress (ADR-012 unchanged)

`allow_unauthenticated = false` remains.  The distinction between
*Cloud Run identity token* (IAM) and *SSW application JWT* (tier) is
documented here to avoid future confusion.

### Secret Manager

One new secret: `ssw-jwt-secret`. Manual rotation is acceptable for Sprint 4
(solo operation). Automated rotation via Cloud KMS + Pub/Sub is Sprint 6+.

### Sprint 5 upgrade path

Replace ad-hoc JWT issuance with an OAuth 2.1 AS:
1. Stand up an AS endpoint (`/oauth/token`) on the same Cloud Run service
   or a separate lightweight service.
2. Clients use Client Credentials flow to obtain JWTs.
3. Server-side `verify()` is unchanged — same HS256 signature, same claims.
4. `auth_source` changes from `"jwt"` to `"oauth_client_credentials"`.
5. ADR-013 is superseded by the Sprint 5 OAuth AS ADR.

---

## Related

- ADR-012: Network egress + `allow_unauthenticated = false`
- ADR-014: HITL lockgate (consumes `AuthContext`)
- sprint-4-plan.md §3.1: Interface Freeze definitions
- docs/batch-1-preflight-report.md §2: SDK auth API check (C1)

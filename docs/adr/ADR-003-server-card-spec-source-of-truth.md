# ADR-003: Server Card — v2 §8.3 as product-level source of truth; /.well-known/mcp.json as path

- **Status**: Accepted
- **Date**: 2026-04-27 (Sprint 1, Batch 5)
- **Deciders**: @kabe, SSW core team
- **Scope**: `apps/server/src/server-card.ts` and the `GET /.well-known/mcp.json` route in `apps/server/src/index.ts`

## Context

`docs/specs/v3-supplement.md` §26 lists "`/.well-known/mcp.json` 配信 (Server
Card)" as a Sprint 1 acceptance criterion. The **Model Context Protocol
spec for Server Cards is not yet stable**: it lives in two overlapping
proposals as of 2026-04-27.

| Artifact | Status | Path | Field layout |
|---|---|---|---|
| SEP-1649 (Issue #1649) | Open proposal | `/.well-known/mcp.json` | `$schema`, `version`, `protocolVersion`, `serverInfo{name,title,version}`, `description`, `iconUrl`, `documentationUrl`, `transport{type,endpoint}`, `capabilities` (object), `requires`, `authentication`, `instructions`, `tools/resources/prompts: "dynamic"\|array` |
| SEP-2127 (PR #2127) | Open PR, WG discussion | **Shifted to** `/.well-known/mcp/server-card.json` | Aligned with the `server.json` registry format: `name`, `description`, `title`, `websiteUrl`, `repository`, `version`, `supportedProtocolVersions`, `icons`, `remotes`, `packages`, `capabilities`, `requires`, `_meta` |

Independently of upstream, `docs/specs/v2-comprehensive-design.md` §8.3
specifies a **product-level, 9-field layout** tailored for the Sprint 4
Connectors Directory (Anthropic) and OpenAI Apps SDK submission packets:

```
name, version, description, publisher, capabilities (boolean flags),
auth, compliance, categories, limitations
```

Notable differences from the upstream proposals:

- `capabilities` is a **flat boolean record** (`{ tools: true, resources:
  true, apps: true, tasks: false, prompts: false }`) — directly maps to
  Directory submission checklists, not to MCP protocol's `ServerCapabilities`
  object.
- `compliance` is **SSW-specific**: `dataResidency: "JP"`,
  `certifications: ["P-Mark-roadmap"]`,
  `regulatoryFramework: ["JP-PIPL", "JP-Immigration-Law"]`. Neither SEP
  proposal has an equivalent.
- `limitations` is a **human-readable array** that restates the
  gyoseishoshi-hō §19-1 defense in plain language. Directly consumable
  by Directory reviewers without extra interpretation.
- `publisher`, `categories` match the Directory submission packet fields
  one-to-one.

Chasing a pre-1.0 SEP would (a) rework the payload again when the spec
converges, (b) obscure the Directory-submission fields, (c) risk shipping
Sprint 1 with an implementation that doesn't match the scanner tools
actually in use today (mostly hand-written `curl` probes).

## Decision

1. **Body shape: v2 §8.3's 9-field structure.** Modeled verbatim in the
   `ServerCard` TypeScript interface in `apps/server/src/server-card.ts`
   and returned as-is by `buildServerCard()`.
2. **Path: `/.well-known/mcp.json`** (SEP-1649 style). We prefer this
   over SEP-2127's `/.well-known/mcp/server-card.json` because v3 §26
   explicitly names this path and because directory scanners deployed
   today scan the shorter path.
3. **Omit `$schema`.** Until SEP-1649 or SEP-2127 publishes a stable
   public schema URL, shipping `$schema` would either point at an
   unstable proposal URL or be dead weight.
4. **Serve `Cache-Control: public, max-age=300`** to balance discovery
   freshness with cheap re-fetches by directory bots.
5. Revisit this ADR at each sprint boundary (Sprint 2 kickoff, Sprint 3
   kickoff, Sprint 4 submission prep) to check whether SEP-1649 /
   SEP-2127 has stabilized. Migrate if the canonical shape lands before
   our Directory submission.

## Consequences

Positive:

- Sprint 4 submission packets for Anthropic Connectors Directory and
  OpenAI Apps SDK can copy the `/.well-known/mcp.json` body verbatim
  without any shape translation.
- The `compliance` / `limitations` / `publisher` fields are already
  user-visible via the discovery endpoint, so reviewers can verify SSW's
  regulatory positioning before a single MCP message is exchanged.
- No dependency on unstable upstream proposals — v2 §8.3 is under our
  direct change control.

Negative / follow-up:

- If SEP-1649 or SEP-2127 converges on a conflicting shape before Sprint
  4, we must either migrate the payload or serve two endpoints (legacy
  + upstream-canonical). Cost estimate: ~1 day to add a second route
  with transformed shape.
- `publisher.url` is hardcoded to `https://sugu-kuru.co.jp`. Corporate
  URL changes require a follow-up ADR + server-card.ts edit.
- Third-party tooling that scans for `/.well-known/mcp/server-card.json`
  (SEP-2127 path) will currently see a 404. If such tooling emerges
  during Sprint 2/3, serve the same body at both paths as a cheap
  compatibility alias.
- The `capabilities` boolean format cannot express MCP protocol
  capabilities like `listChanged` or `subscribe`. Directory reviewers
  who expect the protocol-level shape will need to negotiate via the
  actual MCP handshake; this is acceptable for SSW's read-only scope.

## Related

- `docs/specs/v2-comprehensive-design.md` §8.3 (authoritative body shape)
- `docs/specs/v3-supplement.md` §26 (Sprint 1 acceptance criterion
  naming the path)
- SEP-1649: <https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649>
- SEP-2127: <https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127>

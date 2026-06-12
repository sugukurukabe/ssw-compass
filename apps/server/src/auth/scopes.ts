import type { AuthContextType } from "@ssw/shared-types";

export const COMPASS_SCOPES = [
  "compass:read",
  "compass:draft",
  "compass:approve",
  "compass:execute",
] as const;
export type CompassScope = (typeof COMPASS_SCOPES)[number];

const TOOL_SCOPE_REQUIREMENTS: Record<string, CompassScope> = {
  search_visa: "compass:read",
  classify_procedure: "compass:read",
  get_deadline_timeline: "compass:read",
  list_visa_documents: "compass:read",
  validate_zairyu_compatibility: "compass:read",
  list_law_updates: "compass:read",
  prepare_document_package: "compass:draft",
  submit_gyoseishoshi_approval: "compass:approve",
  get_package_status: "compass:draft",
};

export function scopesForAuthContext(ctx: AuthContextType): Set<CompassScope> {
  const scopes = new Set<CompassScope>(["compass:read"]);
  if (ctx.tier === "pro" || ctx.tier === "business") {
    scopes.add("compass:draft");
  }
  if ((ctx.tier === "pro" || ctx.tier === "business") && ctx.gyoseishoshi_verified) {
    scopes.add("compass:approve");
  }
  if (ctx.tier === "business") {
    scopes.add("compass:execute");
  }
  return scopes;
}

export function requiredScopeForTool(toolName: string | undefined): CompassScope | undefined {
  if (toolName === undefined) {
    return undefined;
  }
  return TOOL_SCOPE_REQUIREMENTS[toolName];
}

export function hasScope(ctx: AuthContextType, scope: CompassScope): boolean {
  return scopesForAuthContext(ctx).has(scope);
}

export function buildWwwAuthenticate(scope: CompassScope): string {
  return `Bearer error="insufficient_scope", scope="${scope}", error_description="Additional SSW Compass consent is required"`;
}

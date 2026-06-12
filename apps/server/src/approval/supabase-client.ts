/**
 * 承認フロー専用の Supabase 管理クライアント
 * Supabase admin client dedicated to approval flows
 * Klien admin Supabase khusus untuk alur persetujuan
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalDatabase } from "./database.js";

let cachedClient: SupabaseClient<ApprovalDatabase> | null = null;

export function getApprovalSupabaseClient(): SupabaseClient<ApprovalDatabase> {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (url === undefined || url.length === 0) {
    throw new Error("SUPABASE_URL is required for approval state storage");
  }
  if (serviceRoleKey === undefined || serviceRoleKey.length === 0) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for approval state storage");
  }

  // service_role はサーバー専用。UI / MCP Apps Resource へ露出しない。
  // service_role is server-only and must never be exposed to UI resources.
  // service_role hanya untuk server dan tidak boleh diekspos ke resource UI.
  cachedClient = createClient<ApprovalDatabase>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedClient;
}

export function __setApprovalSupabaseClientForTesting(
  client: SupabaseClient<ApprovalDatabase> | null,
): void {
  cachedClient = client;
}

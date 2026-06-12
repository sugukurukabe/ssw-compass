/**
 * approval_requests / drafts の Supabase リポジトリ
 * Supabase repository for approval_requests and drafts
 * Repositori Supabase untuk approval_requests dan drafts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovalDatabase } from "./database.js";
import { generateApprovalRequestId } from "./ids.js";
import { getApprovalSupabaseClient } from "./supabase-client.js";
import type {
  ApprovalRequestRecord,
  ApprovalStatus,
  CreateApprovalRequestInput,
  CreateDraftInput,
  DraftRecord,
  TransitionDecision,
} from "./types.js";

export class ApprovalRepositoryError extends Error {
  constructor(
    message: string,
    public readonly causeMessage?: string,
  ) {
    super(message);
    this.name = "ApprovalRepositoryError";
  }
}

export type ApprovalTransitionUpdateResult =
  | { updated: true; row: ApprovalRequestRecord }
  | { updated: false };

export class ApprovalRepository {
  constructor(
    private readonly client: SupabaseClient<ApprovalDatabase> = getApprovalSupabaseClient(),
  ) {}

  async createDraft(input: CreateDraftInput): Promise<DraftRecord> {
    const { data, error } = await this.client
      .from("drafts")
      .insert({
        case_handle: input.caseHandle,
        sha256: input.sha256,
        storage_uri: input.storageUri ?? null,
        expires_at: input.expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to create draft", error.message);
    }
    return data;
  }

  async createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequestRecord> {
    const { data, error } = await this.client
      .from("approval_requests")
      .insert({
        id: generateApprovalRequestId(),
        draft_id: input.draftId,
        draft_sha256: input.draftSha256,
        principal: input.principal,
        step: input.step,
        parent_id: input.parentId ?? null,
        idempotency_key: input.idempotencyKey,
        expires_at: input.expiresAt.toISOString(),
        trace_id: input.traceId ?? null,
      })
      .select()
      .single();

    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to create approval request", error.message);
    }
    return data;
  }

  async getDraft(id: string): Promise<DraftRecord | null> {
    const { data, error } = await this.client.from("drafts").select().eq("id", id).maybeSingle();
    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to read draft", error.message);
    }
    return data;
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
    const { data, error } = await this.client
      .from("approval_requests")
      .select()
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to read approval request", error.message);
    }
    return data;
  }

  async transitionPendingApproval(input: {
    id: string;
    nextStatus: Exclude<ApprovalStatus, "pending">;
    decision: Exclude<TransitionDecision, "execute">;
    now: Date;
  }): Promise<ApprovalTransitionUpdateResult> {
    const { data, error } = await this.client
      .from("approval_requests")
      .update({
        status: input.nextStatus,
        decision: input.decision,
        decided_at: input.now.toISOString(),
      })
      .eq("id", input.id)
      .eq("status", "pending")
      .gt("expires_at", input.now.toISOString())
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to transition pending approval", error.message);
    }
    return data === null ? { updated: false } : { updated: true, row: data };
  }

  async markExecuted(input: { id: string; now: Date }): Promise<ApprovalTransitionUpdateResult> {
    const { data, error } = await this.client
      .from("approval_requests")
      .update({
        status: "executed",
        decision: "execute",
        decided_at: input.now.toISOString(),
      })
      .eq("id", input.id)
      .eq("status", "approved")
      .select()
      .maybeSingle();

    if (error !== null) {
      throw new ApprovalRepositoryError("Failed to mark approval executed", error.message);
    }
    return data === null ? { updated: false } : { updated: true, row: data };
  }
}

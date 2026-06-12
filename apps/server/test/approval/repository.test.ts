import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ApprovalDatabase } from "../../src/approval/database.js";
import { ApprovalRepository } from "../../src/approval/repository.js";
import type { ApprovalRequestRecord, DraftRecord } from "../../src/approval/types.js";

const NOW = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = "2026-06-13T00:00:00.000Z";
const SHA = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

type FakeResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type Filter = {
  column: string;
  operator: "eq" | "gt";
  value: unknown;
};

class FakeQueryBuilder<T extends Record<string, unknown>> {
  private filters: Filter[] = [];
  private updateValues: Partial<T> | null = null;
  private insertValues: Partial<T> | null = null;

  constructor(private readonly rows: T[]) {}

  insert(values: Partial<T>): FakeQueryBuilder<T> {
    this.insertValues = values;
    return this;
  }

  update(values: Partial<T>): FakeQueryBuilder<T> {
    this.updateValues = values;
    return this;
  }

  select(): FakeQueryBuilder<T> {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder<T> {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  gt(column: string, value: unknown): FakeQueryBuilder<T> {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  async single(): Promise<FakeResponse<T>> {
    if (this.insertValues !== null) {
      const row = this.insertValues as T;
      this.rows.push(row);
      return { data: row, error: null };
    }
    return this.maybeSingle();
  }

  async maybeSingle(): Promise<FakeResponse<T>> {
    const row = this.rows.find((candidate) => this.matches(candidate)) ?? null;
    if (row === null) {
      return { data: null, error: null };
    }
    if (this.updateValues !== null) {
      Object.assign(row, this.updateValues);
    }
    return { data: row, error: null };
  }

  private matches(row: T): boolean {
    return this.filters.every((filter) => {
      const value = row[filter.column];
      if (filter.operator === "eq") {
        return value === filter.value;
      }
      if (typeof value === "string" && typeof filter.value === "string") {
        return value > filter.value;
      }
      return false;
    });
  }
}

function makeFakeClient(rows: {
  drafts?: DraftRecord[];
  approvalRequests?: ApprovalRequestRecord[];
}): SupabaseClient<ApprovalDatabase> {
  const client = {
    from: (table: string) => {
      if (table === "drafts") {
        return new FakeQueryBuilder(rows.drafts ?? []);
      }
      if (table === "approval_requests") {
        return new FakeQueryBuilder(rows.approvalRequests ?? []);
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return client as unknown as SupabaseClient<ApprovalDatabase>;
}

function approval(status: ApprovalRequestRecord["status"]): ApprovalRequestRecord {
  return {
    id: "ars_abcdefghijklmnopqrstuv",
    draft_id: "00000000-0000-0000-0000-000000000001",
    draft_sha256: SHA,
    principal: "user-pro-1",
    step: "gyoseishoshi_approval",
    parent_id: null,
    status,
    decision: null,
    idempotency_key: "idem-1",
    expires_at: FUTURE,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    decided_at: null,
    trace_id: null,
  };
}

describe("ApprovalRepository", () => {
  it("transitions a pending request with CAS filters", async () => {
    const row = approval("pending");
    const repository = new ApprovalRepository(makeFakeClient({ approvalRequests: [row] }));

    const result = await repository.transitionPendingApproval({
      id: row.id,
      nextStatus: "approved",
      decision: "approve",
      now: NOW,
    });

    expect(result.updated).toBe(true);
    if (result.updated) {
      expect(result.row.status).toBe("approved");
      expect(result.row.decision).toBe("approve");
      expect(result.row.decided_at).toBe(NOW.toISOString());
    }
  });

  it("returns updated:false for replayed approvals", async () => {
    const row = approval("approved");
    const repository = new ApprovalRepository(makeFakeClient({ approvalRequests: [row] }));

    const result = await repository.transitionPendingApproval({
      id: row.id,
      nextStatus: "approved",
      decision: "approve",
      now: NOW,
    });

    expect(result).toEqual({ updated: false });
  });

  it("returns updated:false for expired approvals", async () => {
    const row = { ...approval("pending"), expires_at: "2026-06-11T00:00:00.000Z" };
    const repository = new ApprovalRepository(makeFakeClient({ approvalRequests: [row] }));

    const result = await repository.transitionPendingApproval({
      id: row.id,
      nextStatus: "approved",
      decision: "approve",
      now: NOW,
    });

    expect(result).toEqual({ updated: false });
  });
});

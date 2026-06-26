/**
 * T12: レスポンス最小化 — ツール応答に非機能的な内部識別子が含まれないことを検証する。
 * T12: Response minimization — verifies tool responses carry no non-functional internal IDs.
 * T12: Minimisasi respons — memverifikasi respons alat tidak memuat ID internal non-fungsional.
 *
 * 検証する受け入れ条件 (master-plan T12):
 * - content / structuredContent / _meta に trace ID・session ID・内部 DB ID 等の
 *   非機能的内部識別子が含まれないこと。
 * - 機能契約上必要な ID (task_id 等) は保持されること (削除しない)。
 *
 * 注意 / Note / Catatan:
 * - `task_id` (ポーリング/再開) と MRTR の `requestState` は機能契約のため保持する。
 * - OTel trace は span にのみ載り (apps/server/src/otel.ts)、応答には出ない。
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AuthContextType } from "@ssw/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithAuthContext } from "../../src/auth/auth-store.js";
import { getPackageStatusHandler } from "../../src/tools/get-package-status/handler.js";
import { prepareDocumentPackageHandler } from "../../src/tools/prepare-document-package/handler.js";
import {
  __setPackageObjectFileFactoryForTesting,
  type PackageObjectFileForTesting,
  type PackageObjectSaveOptions,
} from "../../src/tools/prepare-document-package/service.js";
import { submitGyoseishoshiApprovalHandler } from "../../src/tools/submit-gyoseishoshi-approval/handler.js";

vi.mock("@google-cloud/tasks", () => ({
  CloudTasksClient: vi.fn(() => ({
    createTask: vi.fn(async () => [{ name: "tasks/document-package" }]),
  })),
}));

// 非機能的な内部識別子 (応答に現れてはならない)。
// Non-functional internal identifiers that must never appear in a response.
// Pengidentifikasi internal non-fungsional yang tak boleh muncul di respons.
const FORBIDDEN_INTERNAL_ID_TOKENS = [
  "trace",
  "traceparent",
  "tracestate",
  "session",
  "span_id",
  "spanid",
  "internal_id",
  "internalid",
  "db_id",
  "dbid",
  "row_id",
  "rowid",
  "audit_event",
  "audit_id",
  "ip_address",
  "user_id",
  "user-id",
];

function assertNoInternalIds(result: CallToolResult): void {
  const serialized = JSON.stringify(result).toLowerCase();
  for (const token of FORBIDDEN_INTERNAL_ID_TOKENS) {
    expect(serialized, `forbidden internal id token leaked: ${token}`).not.toContain(token);
  }
}

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo-response-min",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

interface StoredObject {
  data: Buffer;
  customMetadata: Record<string, string | undefined>;
}

class MemoryPackageObjectFile implements PackageObjectFileForTesting {
  constructor(
    private readonly objectName: string,
    private readonly store: Map<string, StoredObject>,
  ) {}

  async exists(): Promise<boolean> {
    return this.store.has(this.objectName);
  }

  async readText(): Promise<string> {
    const stored = this.store.get(this.objectName);
    if (stored === undefined) {
      throw new Error(`Missing object: ${this.objectName}`);
    }
    return stored.data.toString("utf8");
  }

  async save(data: Buffer, options: PackageObjectSaveOptions): Promise<void> {
    if (options.onlyIfAbsent === true && this.store.has(this.objectName)) {
      const error = new Error(`Object already exists: ${this.objectName}`) as Error & {
        code: number;
      };
      error.code = 412;
      throw error;
    }
    this.store.set(this.objectName, { data, customMetadata: options.customMetadata ?? {} });
  }

  async getCustomMetadata(): Promise<Record<string, string | undefined>> {
    const stored = this.store.get(this.objectName);
    if (stored === undefined) {
      throw new Error(`Missing object metadata: ${this.objectName}`);
    }
    return stored.customMetadata;
  }

  async getSignedUrl(expiresAt: Date): Promise<string> {
    return `https://storage.test/${encodeURIComponent(this.objectName)}?expires=${encodeURIComponent(
      expiresAt.toISOString(),
    )}`;
  }
}

const PREPARE_INPUT = {
  procedure_type: "zairyu_shikaku_henko" as const,
  visa_category: "tokutei_ginou_1" as const,
  industry: "agriculture" as const,
  language: "ja" as const,
  case_handle: "SAMPLE-CASE-MIN-1",
  idempotency_key: "idem-response-min-1",
};

describe("response minimization — Pro success path keeps functional IDs, drops internal IDs (T12)", () => {
  const previousBucket = process.env["PACKAGE_ARTIFACT_BUCKET"];
  let store: Map<string, StoredObject>;

  beforeEach(() => {
    process.env["PACKAGE_ARTIFACT_BUCKET"] = "ssw-package-test";
    delete process.env["PACKAGE_ASYNC_ENABLED"];
    store = new Map<string, StoredObject>();
    __setPackageObjectFileFactoryForTesting(
      (_bucketName, objectName) => new MemoryPackageObjectFile(objectName, store),
    );
  });

  afterEach(() => {
    __setPackageObjectFileFactoryForTesting(null);
    if (previousBucket === undefined) {
      delete process.env["PACKAGE_ARTIFACT_BUCKET"];
    } else {
      process.env["PACKAGE_ARTIFACT_BUCKET"] = previousBucket;
    }
  });

  it("prepare_document_package: completed response keeps task_id (functional) and leaks no internal IDs", async () => {
    const result = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(PREPARE_INPUT),
    );

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as Record<string, unknown> | undefined;
    // 機能契約 ID (ポーリング/再開) は保持されること。
    expect(typeof structured?.["task_id"]).toBe("string");
    expect(structured?.["task_id"]).toMatch(/^task_[A-Za-z0-9_-]{22}$/);
    // 非機能的内部 ID は漏れないこと。
    assertNoInternalIds(result);
  });
});

describe("response minimization — Pro denial / PII paths leak no internal IDs (T12)", () => {
  it("get_package_status: PII-blocked response carries no internal IDs", async () => {
    const result = await getPackageStatusHandler({
      // 旅券様パターンを含む idempotency_key → PII ガードで早期拒否 (オフライン)。
      idempotency_key: "lookup AB1234567",
      language: "ja",
    });
    expect(result.isError).toBe(true);
    assertNoInternalIds(result);
  });

  it("submit_gyoseishoshi_approval: anonymous HITL denial carries no internal IDs", async () => {
    const result = await submitGyoseishoshiApprovalHandler({
      case_id: "case_abcd1234efgh5678",
      draft_document_id: "doc_abcd1234efgh5678",
      draft_content_hash: `sha256:${"a".repeat(64)}`,
      approval_method: "checkbox_only",
      approver_gyoseishoshi_number: "東京都 12345",
      language: "ja",
    });
    expect(result.isError).toBe(true);
    assertNoInternalIds(result);
  });
});

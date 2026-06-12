import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AuthContextType } from "@ssw/shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithAuthContext } from "../../../src/auth/auth-store.js";
import { prepareDocumentPackageHandler } from "../../../src/tools/prepare-document-package/handler.js";
import {
  __setPackageObjectFileFactoryForTesting,
  type PackageObjectFileForTesting,
  type PackageObjectSaveOptions,
} from "../../../src/tools/prepare-document-package/service.js";

type CreateTaskRequest = {
  parent?: string;
  task?: {
    name?: string;
  };
};

type CreateTaskMock = (request: CreateTaskRequest) => Promise<readonly [{ name: string }]>;

const createTaskMock = vi.hoisted(() =>
  vi.fn<CreateTaskMock>(async () => [{ name: "tasks/document-package" }]),
);

vi.mock("@google-cloud/tasks", () => ({
  CloudTasksClient: vi.fn(() => ({
    createTask: createTaskMock,
  })),
}));

const PRO_GYO: AuthContextType = {
  user_id: "pro-gyo-prepare-package",
  tier: "pro",
  gyoseishoshi_verified: true,
  gyoseishoshi_number: "東京都 12345",
  auth_source: "jwt",
  issued_at: 1000,
};

const BASE_INPUT = {
  procedure_type: "zairyu_shikaku_henko" as const,
  visa_category: "tokutei_ginou_1" as const,
  industry: "agriculture" as const,
  language: "ja" as const,
  case_handle: "SAMPLE-CASE-0001",
  idempotency_key: "idem-handler-0001",
};

interface StoredObject {
  data: Buffer;
  customMetadata: Record<string, string | undefined>;
}

class MemoryPackageObjectFile implements PackageObjectFileForTesting {
  constructor(
    private readonly objectName: string,
    private readonly store: Map<string, StoredObject>,
    private readonly saveLog: string[],
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
    this.store.set(this.objectName, {
      data,
      customMetadata: options.customMetadata ?? {},
    });
    this.saveLog.push(this.objectName);
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

function structuredContent(result: CallToolResult): Record<string, unknown> {
  const structured = result.structuredContent;
  if (typeof structured !== "object" || structured === null || Array.isArray(structured)) {
    throw new Error("Expected structuredContent object");
  }
  return structured as Record<string, unknown>;
}

describe("prepare_document_package handler — idempotency", () => {
  const previousBucket = process.env["PACKAGE_ARTIFACT_BUCKET"];
  const previousAsyncEnabled = process.env["PACKAGE_ASYNC_ENABLED"];
  const previousQueuePath = process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"];
  const previousExecutorUrl = process.env["PACKAGE_EXECUTOR_URL"];
  const previousExecutorServiceAccountEmail =
    process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"];
  const previousExecutorAudience = process.env["PACKAGE_EXECUTOR_AUDIENCE"];
  let store: Map<string, StoredObject>;
  let saveLog: string[];

  beforeEach(() => {
    process.env["PACKAGE_ARTIFACT_BUCKET"] = "ssw-package-test";
    delete process.env["PACKAGE_ASYNC_ENABLED"];
    delete process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"];
    delete process.env["PACKAGE_EXECUTOR_URL"];
    delete process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"];
    delete process.env["PACKAGE_EXECUTOR_AUDIENCE"];
    store = new Map<string, StoredObject>();
    saveLog = [];
    createTaskMock.mockClear();
    __setPackageObjectFileFactoryForTesting(
      (_bucketName, objectName) => new MemoryPackageObjectFile(objectName, store, saveLog),
    );
  });

  afterEach(() => {
    __setPackageObjectFileFactoryForTesting(null);
    if (previousBucket === undefined) {
      delete process.env["PACKAGE_ARTIFACT_BUCKET"];
    } else {
      process.env["PACKAGE_ARTIFACT_BUCKET"] = previousBucket;
    }
    if (previousAsyncEnabled === undefined) {
      delete process.env["PACKAGE_ASYNC_ENABLED"];
    } else {
      process.env["PACKAGE_ASYNC_ENABLED"] = previousAsyncEnabled;
    }
    if (previousQueuePath === undefined) {
      delete process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"];
    } else {
      process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"] = previousQueuePath;
    }
    if (previousExecutorUrl === undefined) {
      delete process.env["PACKAGE_EXECUTOR_URL"];
    } else {
      process.env["PACKAGE_EXECUTOR_URL"] = previousExecutorUrl;
    }
    if (previousExecutorServiceAccountEmail === undefined) {
      delete process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"];
    } else {
      process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"] = previousExecutorServiceAccountEmail;
    }
    if (previousExecutorAudience === undefined) {
      delete process.env["PACKAGE_EXECUTOR_AUDIENCE"];
    } else {
      process.env["PACKAGE_EXECUTOR_AUDIENCE"] = previousExecutorAudience;
    }
  });

  it("reuses the same task and stored artifact for repeated idempotency_key calls", async () => {
    const first = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(BASE_INPUT),
    );
    const second = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(BASE_INPUT),
    );

    expect(first.isError).toBeFalsy();
    expect(second.isError).toBeFalsy();
    expect(structuredContent(second)["task_id"]).toBe(structuredContent(first)["task_id"]);
    expect(structuredContent(second)["status"]).toBe("completed");
    expect(saveLog).toHaveLength(2);
    expect(saveLog.filter((objectName) => objectName.endsWith("/package.json"))).toHaveLength(1);
  });

  it("rejects the same idempotency_key when the request payload changes", async () => {
    const first = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(BASE_INPUT),
    );
    const conflict = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler({ ...BASE_INPUT, case_handle: "SAMPLE-CASE-0002" }),
    );

    expect(first.isError).toBeFalsy();
    expect(conflict.isError).toBe(true);
    const block = conflict.content[0];
    const text = block !== undefined && block.type === "text" ? block.text : "";
    expect(text).toContain("同じ idempotency_key");
    expect(saveLog).toHaveLength(2);
  });

  it("falls back to synchronous package generation when an async retry finds a duplicate task", async () => {
    process.env["PACKAGE_ASYNC_ENABLED"] = "true";
    process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"] =
      "projects/ssw/locations/asia-northeast1/queues/package-jobs";
    process.env["PACKAGE_EXECUTOR_URL"] = "https://executor.example.run.app/package";
    process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"] =
      "package-executor@ssw.iam.gserviceaccount.com";

    const first = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(BASE_INPUT),
    );
    const alreadyExists = new Error("task already exists") as Error & { code: string };
    alreadyExists.code = "ALREADY_EXISTS";
    createTaskMock.mockRejectedValueOnce(alreadyExists);
    const retry = await runWithAuthContext(PRO_GYO, () =>
      prepareDocumentPackageHandler(BASE_INPUT),
    );

    expect(first.isError).toBeFalsy();
    expect(retry.isError).toBeFalsy();
    expect(structuredContent(first)["status"]).toBe("queued");
    expect(structuredContent(retry)["status"]).toBe("completed");
    expect(structuredContent(retry)["task_id"]).toBe(structuredContent(first)["task_id"]);
    expect(saveLog.filter((objectName) => objectName.endsWith("/package.json"))).toHaveLength(1);
    expect(createTaskMock).toHaveBeenCalledTimes(2);
  });
});

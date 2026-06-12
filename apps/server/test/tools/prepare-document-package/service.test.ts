import type { PrepareDocumentPackageInput } from "@ssw/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDocumentPackageArtifact,
  buildDocumentPackageRequestFingerprint,
  buildPackageIdempotencyScopeHash,
  enqueuePackageTask,
  generateDocumentPackageTaskId,
} from "../../../src/tools/prepare-document-package/service.js";

type CreateTaskRequest = {
  parent?: string;
  task?: {
    name?: string;
    httpRequest?: {
      httpMethod?: string;
      url?: string;
      headers?: Record<string, string>;
      body?: string;
      oidcToken?: {
        serviceAccountEmail?: string;
        audience?: string;
      };
    };
    dispatchDeadline?: {
      seconds?: number;
    };
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

const ASYNC_ENV_KEYS = [
  "PACKAGE_ASYNC_ENABLED",
  "PACKAGE_CLOUD_TASKS_QUEUE_PATH",
  "PACKAGE_EXECUTOR_URL",
  "PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL",
  "PACKAGE_EXECUTOR_AUDIENCE",
] as const;

const PACKAGE_INPUT: PrepareDocumentPackageInput = {
  procedure_type: "zairyu_shikaku_henko",
  visa_category: "tokutei_ginou_1",
  industry: "agriculture",
  language: "ja",
  case_handle: "SAMPLE-CASE-0001",
  idempotency_key: "idem-sample-0001",
};

afterEach(() => {
  createTaskMock.mockClear();
  for (const key of ASYNC_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("prepare_document_package service", () => {
  it("generates task IDs with the frozen prefix", () => {
    expect(generateDocumentPackageTaskId()).toMatch(/^task_[A-Za-z0-9_-]{22}$/);
  });

  it("builds a JSON artifact without personal identifiers", () => {
    const artifact = buildDocumentPackageArtifact(PACKAGE_INPUT);
    const parsed = JSON.parse(artifact.toString("utf8")) as Record<string, unknown>;
    expect(parsed["product"]).toBe("SSW Compass");
    expect(parsed["case_handle"]).toBe("SAMPLE-CASE-0001");
    expect(JSON.stringify(parsed)).not.toContain("passport");
    expect(JSON.stringify(parsed)).not.toContain("residence card");
  });

  it("requires an executor service account when async Cloud Tasks dispatch is enabled", async () => {
    process.env["PACKAGE_ASYNC_ENABLED"] = "true";
    process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"] =
      "projects/ssw/locations/asia-northeast1/queues/package-jobs";
    process.env["PACKAGE_EXECUTOR_URL"] = "https://executor.example.run.app/package";

    await expect(
      enqueuePackageTask({ taskId: "task_authrequired00000000", payload: PACKAGE_INPUT }),
    ).rejects.toThrow(
      "PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL is required when PACKAGE_ASYNC_ENABLED=true",
    );
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("attaches an OIDC token to package executor Cloud Tasks requests", async () => {
    process.env["PACKAGE_ASYNC_ENABLED"] = "true";
    process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"] =
      "projects/ssw/locations/asia-northeast1/queues/package-jobs";
    process.env["PACKAGE_EXECUTOR_URL"] = "https://executor.example.run.app/package";
    process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"] =
      "package-executor@ssw.iam.gserviceaccount.com";
    process.env["PACKAGE_EXECUTOR_AUDIENCE"] = "https://executor.example.run.app";

    await expect(
      enqueuePackageTask({ taskId: "task_authenticated000000", payload: PACKAGE_INPUT }),
    ).resolves.toBe("queued");

    expect(createTaskMock).toHaveBeenCalledWith({
      parent: "projects/ssw/locations/asia-northeast1/queues/package-jobs",
      task: {
        name: "projects/ssw/locations/asia-northeast1/queues/package-jobs/tasks/task_authenticated000000",
        httpRequest: {
          httpMethod: "POST",
          url: "https://executor.example.run.app/package",
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(
            JSON.stringify({ taskId: "task_authenticated000000", input: PACKAGE_INPUT }),
          ).toString("base64"),
          oidcToken: {
            serviceAccountEmail: "package-executor@ssw.iam.gserviceaccount.com",
            audience: "https://executor.example.run.app",
          },
        },
        dispatchDeadline: { seconds: 600 },
      },
    });
  });

  it("reports duplicate package Cloud Tasks separately from newly queued tasks", async () => {
    process.env["PACKAGE_ASYNC_ENABLED"] = "true";
    process.env["PACKAGE_CLOUD_TASKS_QUEUE_PATH"] =
      "projects/ssw/locations/asia-northeast1/queues/package-jobs";
    process.env["PACKAGE_EXECUTOR_URL"] = "https://executor.example.run.app/package";
    process.env["PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL"] =
      "package-executor@ssw.iam.gserviceaccount.com";
    const alreadyExists = new Error("task already exists") as Error & { code: string };
    alreadyExists.code = "ALREADY_EXISTS";
    createTaskMock.mockRejectedValueOnce(alreadyExists);

    await expect(
      enqueuePackageTask({ taskId: "task_duplicate0000000000", payload: PACKAGE_INPUT }),
    ).resolves.toBe("already_exists");
  });

  it("scopes idempotency keys by authenticated subject", () => {
    const first = buildPackageIdempotencyScopeHash({
      authSubject: "user-a",
      idempotencyKey: "idem-sample-0001",
    });
    const second = buildPackageIdempotencyScopeHash({
      authSubject: "user-b",
      idempotencyKey: "idem-sample-0001",
    });

    expect(first).not.toBe(second);
  });

  it("fingerprints the full package request payload", () => {
    const base = {
      procedure_type: "zairyu_shikaku_henko" as const,
      visa_category: "tokutei_ginou_1" as const,
      industry: "agriculture" as const,
      language: "ja" as const,
      case_handle: "SAMPLE-CASE-0001",
      idempotency_key: "idem-sample-0001",
    };

    expect(buildDocumentPackageRequestFingerprint(base)).toBe(
      buildDocumentPackageRequestFingerprint({ ...base }),
    );
    expect(buildDocumentPackageRequestFingerprint(base)).not.toBe(
      buildDocumentPackageRequestFingerprint({ ...base, case_handle: "SAMPLE-CASE-0002" }),
    );
  });
});

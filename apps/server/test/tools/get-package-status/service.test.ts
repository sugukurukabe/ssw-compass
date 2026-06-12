/**
 * lookupPackageStatus の単体テスト
 * Unit tests for lookupPackageStatus (get_package_status backing service)
 * Uji unit lookupPackageStatus
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __setPackageObjectFileFactoryForTesting,
  buildPackageIdempotencyScopeHash,
  lookupPackageStatus,
  type PackageObjectFileForTesting,
} from "../../../src/tools/prepare-document-package/service.js";

const BUCKET = "test-packages";
const AUTH_SUBJECT = "user-pro-1";
const IDEM = "idem-status-0001";
const FINGERPRINT = "fp-abc";

// オブジェクト名 → 内容/メタデータ のインメモリ GCS フェイク。
type FakeObject = { body: string; metadata: Record<string, string> };

function makeFactory(store: Map<string, FakeObject>) {
  return (_bucket: string, objectName: string): PackageObjectFileForTesting => ({
    async exists() {
      return store.has(objectName);
    },
    async readText() {
      return store.get(objectName)?.body ?? "";
    },
    async save(data, options) {
      store.set(objectName, {
        body: data.toString("utf8"),
        metadata: options.customMetadata ?? {},
      });
    },
    async getCustomMetadata() {
      return store.get(objectName)?.metadata ?? {};
    },
    async getSignedUrl() {
      return `https://storage.googleapis.com/${BUCKET}/${objectName}?sig=test`;
    },
  });
}

function idempotencyObjectName(): string {
  const scopeHash = buildPackageIdempotencyScopeHash({
    authSubject: AUTH_SUBJECT,
    idempotencyKey: IDEM,
  });
  return `document-packages/idempotency/${scopeHash}.json`;
}

describe("lookupPackageStatus", () => {
  let store: Map<string, FakeObject>;

  beforeEach(() => {
    process.env["PACKAGE_ARTIFACT_BUCKET"] = BUCKET;
    store = new Map();
    __setPackageObjectFileFactoryForTesting(makeFactory(store));
  });

  afterEach(() => {
    __setPackageObjectFileFactoryForTesting(null);
    delete process.env["PACKAGE_ARTIFACT_BUCKET"];
  });

  it("returns found:false when the principal has no record for the key", async () => {
    const result = await lookupPackageStatus({ authSubject: AUTH_SUBJECT, idempotencyKey: IDEM });
    expect(result.found).toBe(false);
  });

  it("returns completed + signed URL when the artifact exists", async () => {
    const taskId = "task_AAAAAAAAAAAAAAAAAAAAAA";
    store.set(idempotencyObjectName(), {
      body: JSON.stringify({
        schema_version: "v1",
        task_id: taskId,
        request_fingerprint: FINGERPRINT,
        created_at: new Date().toISOString(),
      }),
      metadata: {},
    });
    store.set(`document-packages/${taskId}/package.json`, {
      body: "{}",
      metadata: { request_fingerprint: FINGERPRINT },
    });

    const result = await lookupPackageStatus({ authSubject: AUTH_SUBJECT, idempotencyKey: IDEM });
    expect(result.found).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.taskId).toBe(taskId);
    expect(result.signedUrl).toContain("storage.googleapis.com");
  });

  it("returns running when the record exists but the artifact is not yet written", async () => {
    const taskId = "task_BBBBBBBBBBBBBBBBBBBBBB";
    store.set(idempotencyObjectName(), {
      body: JSON.stringify({
        schema_version: "v1",
        task_id: taskId,
        request_fingerprint: FINGERPRINT,
        created_at: new Date().toISOString(),
      }),
      metadata: {},
    });

    const result = await lookupPackageStatus({ authSubject: AUTH_SUBJECT, idempotencyKey: IDEM });
    expect(result.found).toBe(true);
    expect(result.status).toBe("running");
    expect(result.signedUrl).toBeUndefined();
  });

  it("scopes lookups per principal (other principal sees found:false)", async () => {
    const taskId = "task_CCCCCCCCCCCCCCCCCCCCCC";
    store.set(idempotencyObjectName(), {
      body: JSON.stringify({
        schema_version: "v1",
        task_id: taskId,
        request_fingerprint: FINGERPRINT,
        created_at: new Date().toISOString(),
      }),
      metadata: {},
    });
    store.set(`document-packages/${taskId}/package.json`, {
      body: "{}",
      metadata: { request_fingerprint: FINGERPRINT },
    });

    const other = await lookupPackageStatus({
      authSubject: "different-user",
      idempotencyKey: IDEM,
    });
    expect(other.found).toBe(false);
  });
});

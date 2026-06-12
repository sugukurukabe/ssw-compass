/**
 * 書類パッケージ成果物の生成・保存
 * Generate and store document package artifacts
 * Membuat dan menyimpan artefak paket dokumen
 */

import { createHash, randomBytes } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { PrepareDocumentPackageInput } from "@ssw/shared-types";
import { lookupDocuments } from "../list-visa-documents/document-catalog.js";

const SIGNED_URL_TTL_MS = 3_600_000;
const IDEMPOTENCY_RECORD_SCHEMA_VERSION = "v1";
const REQUEST_FINGERPRINT_METADATA_KEY = "request_fingerprint";

export interface SavedPackageArtifact {
  storageUri: string;
  signedUrl: string;
  signedUrlExpiresAt: string;
}

export interface PackageObjectSaveOptions {
  contentType: string;
  cacheControl: string;
  customMetadata?: Record<string, string>;
  onlyIfAbsent?: boolean;
}

export interface PackageObjectFileForTesting {
  exists(): Promise<boolean>;
  readText(): Promise<string>;
  save(data: Buffer, options: PackageObjectSaveOptions): Promise<void>;
  getCustomMetadata(): Promise<Record<string, string | undefined>>;
  getSignedUrl(expiresAt: Date): Promise<string>;
}

type PackageObjectFileFactory = (bucketName: string, objectName: string) => PackageObjectFileForTesting;

export interface PackageIdempotencyRecord {
  schema_version: typeof IDEMPOTENCY_RECORD_SCHEMA_VERSION;
  task_id: string;
  request_fingerprint: string;
  created_at: string;
}

export interface PackageIdempotencyResolution {
  created: boolean;
  record: PackageIdempotencyRecord;
}

export class IdempotencyConflictError extends Error {
  public readonly userMessage =
    "同じ idempotency_key が異なる入力内容で再利用されました。" +
    "前回と同じ入力で再試行するか、新しい idempotency_key を指定してください。";

  constructor() {
    super("idempotency_key was reused with a different prepare_document_package input");
    this.name = "IdempotencyConflictError";
  }
}

function createGoogleStorageFile(bucketName: string, objectName: string): PackageObjectFileForTesting {
  const file = new Storage().bucket(bucketName).file(objectName);
  return {
    async exists(): Promise<boolean> {
      const [exists] = await file.exists();
      return exists;
    },
    async readText(): Promise<string> {
      const [data] = await file.download();
      return data.toString("utf8");
    },
    async save(data: Buffer, options: PackageObjectSaveOptions): Promise<void> {
      const metadata: {
        cacheControl: string;
        metadata?: Record<string, string>;
      } = { cacheControl: options.cacheControl };
      if (options.customMetadata !== undefined) {
        metadata.metadata = options.customMetadata;
      }
      const baseOptions = {
        resumable: false,
        contentType: options.contentType,
        metadata,
      };
      if (options.onlyIfAbsent === true) {
        await file.save(data, {
          ...baseOptions,
          preconditionOpts: { ifGenerationMatch: 0 },
        });
        return;
      }
      await file.save(data, baseOptions);
    },
    async getCustomMetadata(): Promise<Record<string, string | undefined>> {
      const [metadata] = await file.getMetadata();
      return metadata.metadata ?? {};
    },
    async getSignedUrl(expiresAt: Date): Promise<string> {
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: expiresAt,
        version: "v4",
      });
      return signedUrl;
    },
  };
}

let packageObjectFileFactory: PackageObjectFileFactory = createGoogleStorageFile;

export function __setPackageObjectFileFactoryForTesting(
  factory: PackageObjectFileFactory | null,
): void {
  packageObjectFileFactory = factory ?? createGoogleStorageFile;
}

function getRequiredEnv(name: string, context: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required ${context}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

export function generateDocumentPackageTaskId(): string {
  return `task_${randomBytes(16).toString("base64url")}`;
}

function requirePackageArtifactBucket(): string {
  const bucketName = process.env["PACKAGE_ARTIFACT_BUCKET"];
  if (bucketName === undefined || bucketName.length === 0) {
    throw new Error("PACKAGE_ARTIFACT_BUCKET is required to store document package artifacts");
  }
  return bucketName;
}

function packageArtifactObjectName(taskId: string): string {
  return `document-packages/${taskId}/package.json`;
}

function packageIdempotencyRecordObjectName(scopeHash: string): string {
  return `document-packages/idempotency/${scopeHash}.json`;
}

function hashBase64Url(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("base64url");
}

export function buildPackageIdempotencyScopeHash(input: {
  authSubject: string;
  idempotencyKey: string;
}): string {
  return hashBase64Url(`${input.authSubject}\0${input.idempotencyKey}`);
}

export function buildDocumentPackageRequestFingerprint(input: PrepareDocumentPackageInput): string {
  const normalized = {
    case_handle: input.case_handle,
    idempotency_key: input.idempotency_key,
    industry: input.industry ?? null,
    language: input.language,
    procedure_type: input.procedure_type,
    visa_category: input.visa_category,
  };
  return hashBase64Url(JSON.stringify(normalized));
}

function isPreconditionFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === 412 || code === "412";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePackageIdempotencyRecord(raw: string): PackageIdempotencyRecord {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error("Stored prepare_document_package idempotency record is malformed");
  }
  const schemaVersion = parsed["schema_version"];
  const taskId = parsed["task_id"];
  const requestFingerprint = parsed["request_fingerprint"];
  const createdAt = parsed["created_at"];
  if (
    schemaVersion !== IDEMPOTENCY_RECORD_SCHEMA_VERSION ||
    typeof taskId !== "string" ||
    !/^task_[A-Za-z0-9_-]{22}$/.test(taskId) ||
    typeof requestFingerprint !== "string" ||
    requestFingerprint.length === 0 ||
    typeof createdAt !== "string" ||
    createdAt.length === 0
  ) {
    throw new Error("Stored prepare_document_package idempotency record is malformed");
  }
  return {
    schema_version: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
    task_id: taskId,
    request_fingerprint: requestFingerprint,
    created_at: createdAt,
  };
}

async function readPackageIdempotencyRecord(
  file: PackageObjectFileForTesting,
): Promise<PackageIdempotencyRecord | null> {
  if (!(await file.exists())) {
    return null;
  }
  return parsePackageIdempotencyRecord(await file.readText());
}

function assertMatchingFingerprint(record: PackageIdempotencyRecord, requestFingerprint: string): void {
  if (record.request_fingerprint !== requestFingerprint) {
    throw new IdempotencyConflictError();
  }
}

export async function resolvePackageIdempotency(input: {
  authSubject: string;
  idempotencyKey: string;
  requestFingerprint: string;
  now?: Date;
}): Promise<PackageIdempotencyResolution> {
  const bucketName = requirePackageArtifactBucket();
  const scopeHash = buildPackageIdempotencyScopeHash({
    authSubject: input.authSubject,
    idempotencyKey: input.idempotencyKey,
  });
  const file = packageObjectFileFactory(bucketName, packageIdempotencyRecordObjectName(scopeHash));
  const existing = await readPackageIdempotencyRecord(file);
  if (existing !== null) {
    assertMatchingFingerprint(existing, input.requestFingerprint);
    return { created: false, record: existing };
  }

  const record: PackageIdempotencyRecord = {
    schema_version: IDEMPOTENCY_RECORD_SCHEMA_VERSION,
    task_id: generateDocumentPackageTaskId(),
    request_fingerprint: input.requestFingerprint,
    created_at: (input.now ?? new Date()).toISOString(),
  };
  try {
    await file.save(Buffer.from(JSON.stringify(record, null, 2), "utf8"), {
      contentType: "application/json; charset=utf-8",
      cacheControl: "private, max-age=0, no-store",
      onlyIfAbsent: true,
    });
    return { created: true, record };
  } catch (error) {
    if (!isPreconditionFailure(error)) {
      throw error;
    }
    const raced = await readPackageIdempotencyRecord(file);
    if (raced === null) {
      throw error;
    }
    assertMatchingFingerprint(raced, input.requestFingerprint);
    return { created: false, record: raced };
  }
}

export function buildDocumentPackageArtifact(input: PrepareDocumentPackageInput): Buffer {
  const documents = lookupDocuments({
    visaCategory: input.visa_category,
    industry: input.industry,
    language: "ja",
  });
  const artifact = {
    product: "SSW Compass",
    generated_at: new Date().toISOString(),
    case_handle: input.case_handle,
    procedure_type: input.procedure_type,
    visa_category: input.visa_category,
    industry: input.industry ?? null,
    documents: documents.map((document) => ({
      id: document.id,
      label: document.label,
      category: document.category,
      status: document.status,
      sourceUrl: document.sourceUrl,
    })),
  };
  return Buffer.from(JSON.stringify(artifact, null, 2), "utf8");
}

export async function savePackageArtifact(input: {
  taskId: string;
  artifact: Buffer;
  now?: Date;
  requestFingerprint: string;
}): Promise<SavedPackageArtifact> {
  const bucketName = requirePackageArtifactBucket();
  const now = input.now ?? new Date();
  const objectName = packageArtifactObjectName(input.taskId);
  const file = packageObjectFileFactory(bucketName, objectName);
  await file.save(input.artifact, {
    contentType: "application/json; charset=utf-8",
    cacheControl: "private, max-age=0, no-store",
    customMetadata: {
      [REQUEST_FINGERPRINT_METADATA_KEY]: input.requestFingerprint,
    },
  });
  const expiresAt = new Date(now.getTime() + SIGNED_URL_TTL_MS);
  const signedUrl = await file.getSignedUrl(expiresAt);

  return {
    storageUri: `gs://${bucketName}/${objectName}`,
    signedUrl,
    signedUrlExpiresAt: expiresAt.toISOString(),
  };
}

export async function findSavedPackageArtifact(input: {
  taskId: string;
  requestFingerprint: string;
  now?: Date;
}): Promise<SavedPackageArtifact | null> {
  const bucketName = requirePackageArtifactBucket();
  const objectName = packageArtifactObjectName(input.taskId);
  const file = packageObjectFileFactory(bucketName, objectName);
  if (!(await file.exists())) {
    return null;
  }
  const metadata = await file.getCustomMetadata();
  if (metadata[REQUEST_FINGERPRINT_METADATA_KEY] !== input.requestFingerprint) {
    throw new IdempotencyConflictError();
  }
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SIGNED_URL_TTL_MS);
  return {
    storageUri: `gs://${bucketName}/${objectName}`,
    signedUrl: await file.getSignedUrl(expiresAt),
    signedUrlExpiresAt: expiresAt.toISOString(),
  };
}

function isAlreadyExists(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === 6 || code === "6" || code === "ALREADY_EXISTS";
}

export async function enqueuePackageTask(input: {
  taskId: string;
  payload: PrepareDocumentPackageInput;
}): Promise<boolean> {
  if (process.env["PACKAGE_ASYNC_ENABLED"] !== "true") {
    return false;
  }
  const context = "when PACKAGE_ASYNC_ENABLED=true";
  const queuePath = getRequiredEnv("PACKAGE_CLOUD_TASKS_QUEUE_PATH", context);
  const executorUrl = getRequiredEnv("PACKAGE_EXECUTOR_URL", context);
  const executorServiceAccountEmail = getRequiredEnv(
    "PACKAGE_EXECUTOR_SERVICE_ACCOUNT_EMAIL",
    context,
  );
  const executorAudience = getOptionalEnv("PACKAGE_EXECUTOR_AUDIENCE") ?? executorUrl;

  const client = new CloudTasksClient();
  try {
    await client.createTask({
      parent: queuePath,
      task: {
        name: `${queuePath}/tasks/${input.taskId}`,
        httpRequest: {
          httpMethod: "POST",
          url: executorUrl,
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(JSON.stringify({ taskId: input.taskId, input: input.payload })).toString(
            "base64",
          ),
          oidcToken: {
            serviceAccountEmail: executorServiceAccountEmail,
            audience: executorAudience,
          },
        },
        dispatchDeadline: { seconds: 600 },
      },
    });
  } catch (error) {
    if (!isAlreadyExists(error)) {
      throw error;
    }
  }
  return true;
}

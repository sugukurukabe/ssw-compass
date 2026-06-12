/**
 * 書類パッケージ成果物の生成・保存
 * Generate and store document package artifacts
 * Membuat dan menyimpan artefak paket dokumen
 */

import { randomBytes } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { CloudTasksClient } from "@google-cloud/tasks";
import type { PrepareDocumentPackageInput } from "@ssw/shared-types";
import { lookupDocuments } from "../list-visa-documents/document-catalog.js";

const SIGNED_URL_TTL_MS = 3_600_000;

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
}): Promise<{ storageUri: string; signedUrl: string; signedUrlExpiresAt: string }> {
  const bucketName = process.env["PACKAGE_ARTIFACT_BUCKET"];
  if (bucketName === undefined || bucketName.length === 0) {
    throw new Error("PACKAGE_ARTIFACT_BUCKET is required to store document package artifacts");
  }

  const now = input.now ?? new Date();
  const objectName = `document-packages/${input.taskId}/package.json`;
  const storage = new Storage();
  const file = storage.bucket(bucketName).file(objectName);
  await file.save(input.artifact, {
    resumable: false,
    contentType: "application/json; charset=utf-8",
    metadata: {
      cacheControl: "private, max-age=0, no-store",
    },
  });
  const expiresAt = new Date(now.getTime() + SIGNED_URL_TTL_MS);
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: expiresAt,
    version: "v4",
  });

  return {
    storageUri: `gs://${bucketName}/${objectName}`,
    signedUrl,
    signedUrlExpiresAt: expiresAt.toISOString(),
  };
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
  await client.createTask({
    parent: queuePath,
    task: {
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
  return true;
}

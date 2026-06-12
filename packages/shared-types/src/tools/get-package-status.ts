/**
 * get_package_status ツールのスキーマ
 * Schemas for the get_package_status tool
 * Skema untuk alat get_package_status
 *
 * prepare_document_package で生成したパッケージの状態を、発行時と同じ
 * idempotency_key で照会する (呼び出し元 principal にスコープされる)。
 * 完了済みなら新しい短期署名 URL を再発行する。
 *
 * Looks up the status of a package created by prepare_document_package using the
 * same idempotency_key (scoped to the caller's principal). Re-issues a fresh
 * short-lived signed URL when the package is completed.
 *
 * Memeriksa status paket yang dibuat oleh prepare_document_package menggunakan
 * idempotency_key yang sama (dibatasi ke principal pemanggil).
 */

import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { DocumentPackageStatus } from "./prepare-document-package.js";

export const GetPackageStatusInput = z
  .object({
    /** prepare_document_package 呼び出し時に指定した idempotency_key と同一の値。 */
    idempotency_key: z.string().min(8).max(120),
    language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
  })
  .strict();
export type GetPackageStatusInput = z.infer<typeof GetPackageStatusInput>;

export const GetPackageStatusOutput = z
  .object({
    /** 照会対象が存在したか (この principal が発行したパッケージか)。 */
    found: z.boolean(),
    status: DocumentPackageStatus.optional(),
    task_id: z
      .string()
      .regex(/^task_[A-Za-z0-9_-]{22}$/)
      .optional(),
    result: z
      .object({
        signed_url: z.string().url().optional(),
        expires_at: z.string().datetime().optional(),
        expired: z.boolean().optional(),
      })
      .strict()
      .optional(),
    disclaimer: z.string(),
  })
  .strict();
export type GetPackageStatusOutput = z.infer<typeof GetPackageStatusOutput>;

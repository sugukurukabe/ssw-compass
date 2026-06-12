/**
 * prepare_document_package ツールのスキーマ
 * Schemas for the prepare_document_package tool
 * Skema untuk alat prepare_document_package
 */

import { z } from "zod";
import { CLASSIFY_INDUSTRY, CLASSIFY_PROCEDURE_TYPE } from "../classify-procedure.js";
import { SUPPORTED_LANGUAGES } from "../i18n/supported-languages.js";
import { DOCUMENTS_VISA_CATEGORY } from "../list-visa-documents.js";

export const PrepareDocumentPackageInput = z
  .object({
    procedure_type: z.enum(CLASSIFY_PROCEDURE_TYPE),
    visa_category: z.enum(DOCUMENTS_VISA_CATEGORY),
    industry: z.enum(CLASSIFY_INDUSTRY).optional(),
    language: z.enum(SUPPORTED_LANGUAGES).default("ja"),
    case_handle: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[A-Z0-9_-]+$/),
    idempotency_key: z.string().min(8).max(120),
  })
  .strict();
export type PrepareDocumentPackageInput = z.infer<typeof PrepareDocumentPackageInput>;

export const DocumentPackageStatus = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type DocumentPackageStatus = z.infer<typeof DocumentPackageStatus>;

export const PrepareDocumentPackageOutput = z
  .object({
    task_id: z
      .string()
      .regex(/^task_[A-Za-z0-9_-]{22}$/)
      .optional(),
    status: DocumentPackageStatus,
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
export type PrepareDocumentPackageOutput = z.infer<typeof PrepareDocumentPackageOutput>;

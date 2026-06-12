/**
 * prepare_document_package handler
 * 書類パッケージを生成し GCS 署名 URL を返す
 * Membuat paket dokumen dan mengembalikan URL bertanda tangan GCS
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  PrepareDocumentPackageInput,
  PrepareDocumentPackageOutput,
  type SupportedLanguage,
} from "@ssw/shared-types";
import { getRequestAuthContext } from "../../auth/auth-store.js";
import { assertHitlGate } from "../../hitl/lockgate.js";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { toToolErrorResult } from "../tool-error.js";
import {
  buildDocumentPackageArtifact,
  enqueuePackageTask,
  buildDocumentPackageRequestFingerprint,
  findSavedPackageArtifact,
  resolvePackageIdempotency,
  savePackageArtifact,
} from "./service.js";

export const prepareDocumentPackageHandler = instrumentTool(
  "prepare_document_package",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = PrepareDocumentPackageInput.parse(rawArgs);
    const lang = args.language as SupportedLanguage;
    const disclaimer = DISCLAIMER_BY_LANG[lang];

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "prepare_document_package", reason: "pii_blocked", findings: piiCheck.types },
        "pii_blocked",
      );
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "個人情報 (在留番号・パスポート番号・マイナンバー等) は入力できません。" +
              `一般的なケースハンドルのみ受け付けます。\n\n${disclaimer}`,
          },
        ],
      };
    }

    const authContext = getRequestAuthContext();
    assertHitlGate(authContext, "prepare_document_package", "L2");

    try {
      const requestFingerprint = buildDocumentPackageRequestFingerprint(args);
      const idempotency = await resolvePackageIdempotency({
        authSubject: authContext.user_id,
        idempotencyKey: args.idempotency_key,
        requestFingerprint,
      });
      const taskId = idempotency.record.task_id;
      const existing = await findSavedPackageArtifact({ taskId, requestFingerprint });
      if (existing !== null) {
        const payload = PrepareDocumentPackageOutput.parse({
          task_id: taskId,
          status: "completed",
          result: {
            signed_url: existing.signedUrl,
            expires_at: existing.signedUrlExpiresAt,
          },
          disclaimer,
        });
        return {
          content: [
            {
              type: "text",
              text:
                `既存の書類パッケージを返します。\n` +
                `task_id: ${taskId}\n` +
                `署名付きURLの有効期限: ${existing.signedUrlExpiresAt}\n\n${disclaimer}`,
            },
          ],
          structuredContent: payload,
        };
      }

      const queued = await enqueuePackageTask({ taskId, payload: args });
      if (queued) {
        const payload = PrepareDocumentPackageOutput.parse({
          task_id: taskId,
          status: "queued",
          disclaimer,
        });
        return {
          content: [
            {
              type: "text",
              text: `書類パッケージ生成をキューに登録しました。\ntask_id: ${taskId}\n\n${disclaimer}`,
            },
          ],
          structuredContent: payload,
        };
      }

      const artifact = buildDocumentPackageArtifact(args);
      const saved = await savePackageArtifact({ taskId, artifact, requestFingerprint });
      const payload = PrepareDocumentPackageOutput.parse({
        task_id: taskId,
        status: "completed",
        result: {
          signed_url: saved.signedUrl,
          expires_at: saved.signedUrlExpiresAt,
        },
        disclaimer,
      });

      logger.info(
        {
          tool: "prepare_document_package",
          task_id: taskId,
          case_handle: args.case_handle,
          storage_uri: saved.storageUri,
          status: "completed",
        },
        "prepare_document_package_completed",
      );

      return {
        content: [
          {
            type: "text",
            text:
              `書類パッケージを生成しました。\n` +
              `task_id: ${taskId}\n` +
              `署名付きURLの有効期限: ${saved.signedUrlExpiresAt}\n\n${disclaimer}`,
          },
        ],
        structuredContent: payload,
      };
    } catch (error) {
      return toToolErrorResult(error, "prepare_document_package", args.language);
    }
  },
);

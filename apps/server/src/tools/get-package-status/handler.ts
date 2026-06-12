/**
 * get_package_status handler
 * 発行済み書類パッケージの状態を照会し、完了済みなら署名 URL を再発行する
 * Looks up a prepared document package's status; re-issues a signed URL when completed
 * Memeriksa status paket dokumen dan menerbitkan ulang URL bertanda tangan jika selesai
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  DISCLAIMER_BY_LANG,
  GetPackageStatusInput,
  GetPackageStatusOutput,
  type SupportedLanguage,
} from "@ssw/shared-types";
import { getRequestAuthContext } from "../../auth/auth-store.js";
import { CACHE_TIERS, withCacheMeta } from "../../cache.js";
import { assertHitlGate } from "../../hitl/lockgate.js";
import { logger } from "../../logger.js";
import { instrumentTool } from "../../otel.js";
import { scrubInputForPII } from "../../pii/index.js";
import { lookupPackageStatus } from "../prepare-document-package/service.js";
import { toToolErrorResult } from "../tool-error.js";

export const getPackageStatusHandler = instrumentTool(
  "get_package_status",
  async (rawArgs: unknown): Promise<CallToolResult> => {
    const args = GetPackageStatusInput.parse(rawArgs);
    const lang = args.language as SupportedLanguage;
    const disclaimer = DISCLAIMER_BY_LANG[lang];

    const piiCheck = await scrubInputForPII(args);
    if (piiCheck.blocked) {
      logger.warn(
        { tool: "get_package_status", reason: "pii_blocked", findings: piiCheck.types },
        "pii_blocked",
      );
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "個人情報 (在留番号・パスポート番号・マイナンバー等) は入力できません。" +
              `一般的な idempotency_key のみ受け付けます。\n\n${disclaimer}`,
          },
        ],
      };
    }

    const authContext = getRequestAuthContext();
    assertHitlGate(authContext, "get_package_status", "L2");

    try {
      const lookup = await lookupPackageStatus({
        authSubject: authContext.user_id,
        idempotencyKey: args.idempotency_key,
      });

      if (!lookup.found) {
        const payload = GetPackageStatusOutput.parse({ found: false, disclaimer });
        return withCacheMeta(
          {
            content: [
              {
                type: "text",
                // この principal が当該 idempotency_key でパッケージを発行していない。
                text: `指定された idempotency_key のパッケージは見つかりませんでした。\n\n${disclaimer}`,
              },
            ],
            structuredContent: payload,
          },
          CACHE_TIERS.C_PRIVATE_NO_STORE,
        );
      }

      if (lookup.status === "completed") {
        const payload = GetPackageStatusOutput.parse({
          found: true,
          status: "completed",
          task_id: lookup.taskId,
          result: {
            signed_url: lookup.signedUrl,
            expires_at: lookup.signedUrlExpiresAt,
          },
          disclaimer,
        });
        return withCacheMeta(
          {
            content: [
              {
                type: "text",
                text:
                  `書類パッケージは生成済みです。\n` +
                  `task_id: ${lookup.taskId}\n` +
                  `署名付きURLの有効期限: ${lookup.signedUrlExpiresAt}\n\n${disclaimer}`,
              },
            ],
            structuredContent: payload,
          },
          CACHE_TIERS.C_PRIVATE_NO_STORE,
        );
      }

      const payload = GetPackageStatusOutput.parse({
        found: true,
        status: lookup.status ?? "running",
        task_id: lookup.taskId,
        disclaimer,
      });
      return withCacheMeta(
        {
          content: [
            {
              type: "text",
              text: `書類パッケージは生成中です。\ntask_id: ${lookup.taskId}\n\n${disclaimer}`,
            },
          ],
          structuredContent: payload,
        },
        CACHE_TIERS.C_PRIVATE_NO_STORE,
      );
    } catch (err: unknown) {
      return toToolErrorResult(err, "get_package_status", lang);
    }
  },
);

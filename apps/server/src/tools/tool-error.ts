/**
 * ツールハンドラ共通のエラー → CallToolResult 変換。
 * Shared handler error-to-result mapping for tool handlers.
 * Pemetaan error-ke-hasil bersama untuk handler alat.
 *
 * 方針:
 * - TierLimitError / HitlGateError のような利用者向けメッセージを持つ想定済み
 *   制御エラーは、その userMessage をそのまま返す。
 * - それ以外 (Vertex API 障害等の予期しない例外) は内部詳細を秘匿し、
 *   一般的な日本語メッセージを返す (logger.error で詳細を記録)。
 * - いずれの場合も免責事項を必ず付与する (.cursor/rules/tools.mdc)。
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DISCLAIMER_BY_LANG, type SupportedLanguage } from "@ssw/shared-types";
import {
  buildUpgradeNotice,
  buildUpgradeNoticeMeta,
  renderUpgradeExplanation,
} from "../auth/upgrade-notice.js";
import { HitlGateError } from "../hitl/lockgate.js";
import { logger } from "../logger.js";

const GENERIC_SYSTEM_ERROR_JA =
  "システムエラーが発生しました。時間をおいて再度お試しください。" +
  "問題が解決しない場合は出入国在留管理庁公式サイト (https://www.moj.go.jp/isa/) をご確認ください。";

function userMessageOf(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "userMessage" in error &&
    typeof (error as { userMessage?: unknown }).userMessage === "string"
  ) {
    return (error as { userMessage: string }).userMessage;
  }
  return undefined;
}

/**
 * ハンドラ内で捕捉した例外を安全な CallToolResult に変換する。
 * Converts a caught handler exception into a safe CallToolResult.
 * Mengubah eksepsi handler yang tertangkap menjadi CallToolResult yang aman.
 */
export function toToolErrorResult(
  error: unknown,
  toolId: string,
  lang: SupportedLanguage = "ja",
): CallToolResult {
  const disclaimer = DISCLAIMER_BY_LANG[lang];
  const known = userMessageOf(error);
  if (known !== undefined) {
    // HITL ロックゲート拒否 (200 + isError) は契約を維持したまま、graceful な
    // 上位移行説明 (Phase 2a) を上乗せする。ゲートは弱めない (説明を載せるだけ)。
    // The HITL lockgate denial keeps its 200 + isError contract; we only enrich
    // the body with a graceful upgrade explanation. The gate is never weakened.
    if (error instanceof HitlGateError) {
      const notice = buildUpgradeNotice({ tool: toolId, lang });
      const explanation = renderUpgradeExplanation(notice);
      return {
        isError: true,
        // 免責 (§19) は末尾に逐語維持。説明は免責の前に挿入する。
        content: [{ type: "text", text: `${known}\n\n${explanation}\n\n${disclaimer}` }],
        _meta: buildUpgradeNoticeMeta(notice),
      };
    }
    return {
      isError: true,
      content: [{ type: "text", text: `${known}\n\n${disclaimer}` }],
    };
  }
  logger.error(
    {
      tool: toolId,
      event: "tool_unhandled_error",
      error_message: error instanceof Error ? error.message : String(error),
    },
    "tool_unhandled_error",
  );
  return {
    isError: true,
    content: [{ type: "text", text: `${GENERIC_SYSTEM_ERROR_JA}\n\n${disclaimer}` }],
  };
}

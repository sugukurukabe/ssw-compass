/**
 * 監査ログ書き込みモジュール (ADR-015 / v4 §2.5 H04_AUDIT_LOG_7Y)
 * Audit log write module
 * Modul penulisan log audit
 *
 * emitAuditEvent() は logger.info で構造化 JSON を出力する。
 * Cloud Logging Sink が非同期で GCS bucket ssw-compass-audit-7y に export する。
 * 7 年 WORM 保持は bucket_lock で保証 (ADR-015)。
 *
 * "Write audit event BEFORE returning content" — H04 テストが確認する。
 */

import { createHash } from "node:crypto";
import type { AuditEventType, CaseIdType } from "@ssw/shared-types";
import { logger } from "../logger.js";

/**
 * 任意の値の sha256 hex を計算する (PII 保護のため本体は保存しない)
 */
export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * 監査イベントを Cloud Logging に書き込む (ADR-015 H04)
 * tool handler は response を組み立てる前にこの関数を呼ぶこと。
 */
export function emitAuditEvent(event: AuditEventType): void {
  logger.info({ event: "audit_event", ...event }, "audit_event");
}

/**
 * Cloud Logging read-back でイベントを取得する (ADR-015 §fetchAuditEvents)
 * Sprint 5: @google-cloud/logging 追加済み、full implementation。
 * 400 日超のアーカイブは GCS から直接読む (Sprint 6 候補)。
 */
export async function fetchAuditEvents(filter: {
  case_id?: CaseIdType;
  tool_id?: string;
  since?: Date;
  limit?: number;
}): Promise<AuditEventType[]> {
  const projectId =
    process.env["CLOUDSDK_CORE_PROJECT"] ??
    process.env["SSW_VERTEX_PROJECT"] ??
    process.env["GOOGLE_CLOUD_PROJECT"];

  if (projectId === undefined || projectId.length === 0) {
    logger.warn(
      { event: "fetch_audit_events_skipped", reason: "no_project_id" },
      "fetch_audit_events_skipped",
    );
    return [];
  }

  const { Logging } = await import("@google-cloud/logging");
  const client = new Logging({ projectId });

  const filterParts: string[] = [
    'jsonPayload.event="audit_event"',
    'resource.type="cloud_run_revision"',
  ];
  if (filter.case_id !== undefined) {
    filterParts.push(`jsonPayload.case_id="${filter.case_id}"`);
  }
  if (filter.tool_id !== undefined) {
    filterParts.push(`jsonPayload.tool_id="${filter.tool_id}"`);
  }
  if (filter.since !== undefined) {
    filterParts.push(`timestamp>="${filter.since.toISOString()}"`);
  }

  try {
    const [entries] = await client.getEntries({
      filter: filterParts.join(" AND "),
      pageSize: filter.limit ?? 50,
      orderBy: "timestamp desc",
    });

    return entries
      .map((entry) => {
        const data = entry.data as Record<string, unknown>;
        const { event: _event, ...rest } = data;
        void _event;
        return rest as AuditEventType;
      })
      .filter((e): e is AuditEventType => {
        return (
          typeof e.timestamp === "string" &&
          typeof e.tool_id === "string" &&
          typeof e.schema_version === "string"
        );
      });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ event: "fetch_audit_events_error", err: message }, "fetch_audit_events_error");
    return [];
  }
}

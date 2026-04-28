/**
 * 監査ログ書き込みモジュール (ADR-015 / v4 §2.5 H04_AUDIT_LOG_7Y)
 * Audit log write module
 * Modul penulisan log audit
 *
 * emitAuditEvent() は logger.info で構造化 JSON を出力する。
 * Cloud Logging がこれをリアルタイムで受信し、
 * Cloud Logging Sink が非同期で GCS bucket ssw-compass-audit-7y に export する。
 * 7 年 WORM 保持は bucket_lock で保証 (ADR-015)。
 *
 * "Write audit event BEFORE returning content" — H04 テストが確認する。
 * tool handler はこの関数を呼んでから response を build すること。
 *
 * fetchAuditEvents() は Cloud Logging API read-back を使う。
 * Firestore は不要 — Cloud Logging の structured query で十分 (ADR-015 §Decision §1)。
 */

import { createHash } from "node:crypto";
import type { Logging } from "@google-cloud/logging";
import type { AuditEventType, CaseIdType } from "@ssw/shared-types";
import { logger } from "../logger.js";

/**
 * 任意の値の sha256 hex を計算する (PII 保護のため本体は保存しない)
 * Calculate sha256 hex for any value (body is not stored to protect PII)
 * Hitung hex sha256 untuk nilai apa pun (isi tidak disimpan untuk melindungi PII)
 */
export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * 監査イベントを Cloud Logging に書き込む (ADR-015 H04)
 * Write audit event to Cloud Logging
 * Tulis peristiwa audit ke Cloud Logging
 *
 * Cloud Logging → GCS Sink が非同期で export するため、
 * この関数の完了 = Cloud Logging への書き込み完了 (GCS への到達は非同期)。
 * tool handler は response を組み立てる前にこの関数を呼ぶこと (H04)。
 */
export function emitAuditEvent(event: AuditEventType): void {
  // Cloud Run では logger.info が Cloud Logging のリアルタイムストリームに書かれる。
  // structured log の event="audit_event" フィールドを Logging Sink のフィルタが検出する。
  logger.info({ event: "audit_event", ...event }, "audit_event");
}

/**
 * Cloud Logging read-back でイベントを取得する (ADR-015 §fetchAuditEvents)
 * Retrieve events via Cloud Logging read-back
 *
 * 主な用途: draft_content_hash の再検証 (case_id でフィルタ)
 * Sprint 4 実装: Cloud Logging API `entries.list` を使用。
 * 400 日超のアーカイブは GCS から直接読む (Sprint 5 実装予定)。
 */
export async function fetchAuditEvents(
  filter: {
    case_id?: CaseIdType;
    tool_id?: string;
    since?: Date;
    limit?: number;
  },
  loggingClient?: Logging,
): Promise<AuditEventType[]> {
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

  // テスト時はモックの loggingClient を注入できる
  const client: Logging =
    loggingClient ??
    (await import("@google-cloud/logging").then(({ Logging }) => new Logging({ projectId })));

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
        // Strip the "event" sentinel field added by emitAuditEvent
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

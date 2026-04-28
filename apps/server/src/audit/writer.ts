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
 * Sprint 4: @google-cloud/logging SDK は server package の依存に未追加のため
 * Sprint 5 での実装を予定。現在は no-op stub を返す。
 * Sprint 5: add @google-cloud/logging to server/package.json and implement.
 */
export async function fetchAuditEvents(filter: {
  case_id?: CaseIdType;
  tool_id?: string;
  since?: Date;
  limit?: number;
}): Promise<AuditEventType[]> {
  // Sprint 5 carry-over: implement with @google-cloud/logging SDK.
  // See ADR-015 §fetchAuditEvents for the intended implementation.
  logger.warn(
    {
      event: "fetch_audit_events_not_implemented",
      filter_case_id: filter.case_id,
      filter_tool_id: filter.tool_id,
    },
    "fetch_audit_events_not_implemented",
  );
  return [];
}

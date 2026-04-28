/**
 * 制度変動カレンダーのフィルタリング
 * Law updates calendar filtering
 * Pemfilteran kalender pembaruan peraturan
 *
 * filterActiveLawUpdates: effective_date <= today の entry を "active" とする純粋関数。
 * recomputeLawUpdateStatus: fixture 全体のステータスを today に基づいて再計算する。
 *
 * Sprint 4: サーバ起動時のみ呼び出す (Cloud Scheduler は Sprint 5)。
 * Sprint 4: Called at server startup only (Cloud Scheduler is Sprint 5).
 * Sprint 4: Hanya dipanggil saat startup server (Cloud Scheduler adalah Sprint 5).
 */

import type { LawUpdate, LawUpdateStatus } from "@ssw/shared-types";

/**
 * 今日 (JST 深夜0時) の Date を返す。
 * timezone offset を考慮: JST = UTC+9。
 */
function todayJst(now: Date = new Date()): Date {
  // JST = UTC + 9h → floor to JST midnight
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstMs = now.getTime() + jstOffsetMs;
  const jstMidnight = new Date(Math.floor(jstMs / 86400000) * 86400000 - jstOffsetMs);
  return jstMidnight;
}

/**
 * effective_date と today を比較してステータスを決定する。
 */
function computeStatus(entry: LawUpdate, today: Date): LawUpdateStatus {
  if (entry.status === "withdrawn") return "withdrawn";
  if (entry.status === "pending_verification") return "pending_verification";
  if (entry.effective_date === "TBD") return "pending_verification";

  const effectiveMs = new Date(entry.effective_date).getTime();
  const todayMs = today.getTime();
  return effectiveMs <= todayMs ? "active" : "pending";
}

/**
 * fixture 全体のステータスを today に基づいて再計算して返す (破壊的変更なし)。
 * Returns new array with updated status values; does not mutate the original.
 *
 * Sprint 4: サーバ起動時 + 毎日午前 3 時 JST に呼び出す想定 (Sprint 5 で Cloud Scheduler)。
 */
export function recomputeLawUpdateStatus(
  fixture: readonly LawUpdate[],
  now?: Date,
): readonly LawUpdate[] {
  const today = todayJst(now);
  return fixture.map((entry) => ({ ...entry, status: computeStatus(entry, today) }));
}

/**
 * today 以前に effective_date を持つ entry のみを返す純粋関数。
 * Pure function returning only entries with effective_date <= today.
 * Fungsi murni yang mengembalikan hanya entri dengan effective_date <= today.
 *
 * "pending_verification" と "withdrawn" および "TBD" は除外する。
 * "status:active" のみ含む。
 */
export function filterActiveLawUpdates(
  fixture: readonly LawUpdate[],
  now?: Date,
): readonly LawUpdate[] {
  const recomputed = recomputeLawUpdateStatus(fixture, now);
  return recomputed.filter((e) => e.status === "active");
}

/**
 * HITL 12 項目の型定義 (ADR-014 / v4 §2.1)
 * HITL 12-item type definitions — Human-In-The-Loop controls
 * Definisi tipe 12 item HITL — kontrol Human-In-The-Loop
 *
 * Interface Freeze (ADR-014): HitlControlId enum は Sprint 4 全期間で不変。
 * Interface Freeze (ADR-014): HitlControlId enum is immutable for all of Sprint 4.
 * Pembekuan antarmuka (ADR-014): Enum HitlControlId tidak berubah selama Sprint 4.
 *
 * Legal basis: 改正行政書士法 §19 (2026-01-01 施行) + 入管法 §73-2 (2025-06 施行)
 */

import { z } from "zod";

export const HitlControlId = z.enum([
  "H01_DRAFT_LOCKGATE", // 個別書類生成のロックゲート (最重要)
  "H02_DRAFT_WATERMARK", // 「下書き/参考資料」明示 UI
  "H03_GYOSEISHOSHI_APPROVAL", // 行政書士最終承認チェックボックス
  "H04_AUDIT_LOG_7Y", // 7年監査ログ
  "H05_HALLUCINATION_NOTICE", // ハルシネーション警告 (ABA Op.512 準拠)
  "H06_ILLEGAL_WORK_ALERT", // §73-2 不法就労判定アラート
  "H07_PII_AUTO_MASKING", // PII 自動マスキング (Sprint 3 の scrubInputForPII が対応)
  "H08_DOUBLE_CONFIRM", // 二重確認プロンプト
  "H09_TEMPLATE_VS_INDIVIDUAL", // テンプレ/個別モード分離
  "H10_LAW_AUTO_UPDATE", // 法令更新の自動適用と注記
  "H11_FEE_TRANSPARENCY", // 報酬の透明性 (内訳分解)
  "H12_LIABILITY_CLAUSE", // 紛争時の責任配分条項
]);
export type HitlControlId = z.infer<typeof HitlControlId>;

/**
 * 法的レベル — tool が操作できる最も低い法的リスク層 (静的なフロア)
 * Legal level — the minimum legal risk tier a tool can operate at (static floor)
 * Tingkat hukum — tingkat risiko hukum minimum yang dapat dioperasikan suatu alat (lantai statis)
 *
 * L4 は実装禁止 (永久禁止)。実装した場合は validateToolAnnotations が crash する。
 * L4 is prohibited. validateToolAnnotations crashes if any tool declares L4.
 */
export const LegalLevel = z.enum(["L0", "L1", "L2", "L3"]);
export type LegalLevel = z.infer<typeof LegalLevel>;

/**
 * v2 §8.3 の既存フィールド + v4 の追加フィールドで構成する tool annotation
 * Tool annotation — existing v2 §8.3 fields + v4 additions
 * Anotasi alat — field v2 §8.3 yang sudah ada + tambahan v4
 *
 * Interface Freeze (ADR-014): この型は Sprint 4 全期間で変更不可。
 */
export interface SswCompassToolAnnotation {
  // ── v2 §8.3 既存フィールド (破壊禁止) ─────────────────────────────────
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
  readonly title: string;

  // ── v4 追加フィールド ─────────────────────────────────────────────────
  /** 静的な法的レベル (フロア)。runtime 引数で escalate される場合あり (ADR-014 §2) */
  readonly legalLevel: LegalLevel;
  /** L2/L3 は true 必須。validateToolAnnotations で enforce。 */
  readonly requiresGyoseishoshiAuth: boolean;
  /** 適用される HITL 項目 ID 一覧 */
  readonly hitlControls: readonly HitlControlId[];
  /** アクセス可能な最小 tier */
  readonly tier: "free" | "pro" | "business";
}

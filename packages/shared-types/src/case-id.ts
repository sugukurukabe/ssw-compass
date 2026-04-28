/**
 * case_id 生成と検証 (ADR-014)
 * case_id generation and validation
 * Pembuatan dan validasi case_id
 *
 * フォーマット: /^case_[a-z0-9]{16}$/ (base36 lowercase, ~82-bit entropy)
 * v4 §3.4 準拠。nanoid customAlphabet を使用。
 *
 * Interface Freeze (ADR-014): CaseId regex と generateCaseId の戻り値フォーマットは Sprint 4 不変。
 */

import { customAlphabet } from "nanoid";
import { z } from "zod";

/** case_id の正規表現パターン — nanoid base36 lowercase 16 文字 */
export const CASE_ID_PATTERN = /^case_[a-z0-9]{16}$/;

export const CaseId = z.string().regex(CASE_ID_PATTERN);
export type CaseId = z.infer<typeof CaseId>;

const _generateSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

/**
 * 新しい case_id を生成する
 * Generate a new case_id
 * Hasilkan case_id baru
 *
 * 戻り値は常に /^case_[a-z0-9]{16}$/ を満たす。
 */
export function generateCaseId(): CaseId {
  return `case_${_generateSuffix()}` as CaseId;
}

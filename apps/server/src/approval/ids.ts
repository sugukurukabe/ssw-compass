/**
 * requestState 用の不透明 ID を生成する
 * Generate opaque IDs for requestState
 * Membuat ID buram untuk requestState
 */

import { randomBytes } from "node:crypto";

const APPROVAL_REQUEST_ID_PREFIX = "ars_";
const APPROVAL_REQUEST_RANDOM_BYTES = 16;

export function generateApprovalRequestId(): string {
  return `${APPROVAL_REQUEST_ID_PREFIX}${randomBytes(APPROVAL_REQUEST_RANDOM_BYTES).toString(
    "base64url",
  )}`;
}

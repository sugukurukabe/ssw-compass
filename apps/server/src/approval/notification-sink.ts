/**
 * 人間対応キューへの通知を抽象化する
 * Abstract notifications to the human handling queue
 * Mengabstraksikan notifikasi ke antrean penanganan manusia
 */

import { logger } from "../logger.js";

export type EscalationEvent = {
  type: "approval_escalated";
  requestState: string;
  reason: string;
};

export type TaskFailedEvent = {
  type: "task_failed";
  taskId: string;
  reason: string;
};

export type NotificationEvent = EscalationEvent | TaskFailedEvent;

export type NotificationSink = {
  notify(event: NotificationEvent): Promise<void>;
};

export const loggingNotificationSink: NotificationSink = {
  async notify(event: NotificationEvent): Promise<void> {
    logger.warn({ event: event.type, ...event }, event.type);
  },
};

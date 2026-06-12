export { generateApprovalRequestId } from "./ids.js";
export {
  type ApplyApprovalResponseResult,
  type ApprovalInputRequiredResult,
  applyApprovalInputResponse,
  buildApprovalInputRequiredResult,
} from "./mrtr.js";
export {
  loggingNotificationSink,
  type NotificationEvent,
  type NotificationSink,
} from "./notification-sink.js";
export {
  ApprovalRepository,
  ApprovalRepositoryError,
  type ApprovalTransitionUpdateResult,
} from "./repository.js";
export {
  type EvaluateApprovalTransitionInput,
  evaluateApprovalTransition,
} from "./state-machine.js";
export {
  __setApprovalSupabaseClientForTesting,
  getApprovalSupabaseClient,
} from "./supabase-client.js";
export type {
  ApprovalRequestRecord,
  ApprovalStatus,
  ApprovalStep,
  CreateApprovalRequestInput,
  CreateDraftInput,
  DraftRecord,
  DraftStatus,
  ParentApprovalSnapshot,
  TransitionDecision,
  TransitionFailureReason,
  TransitionResult,
} from "./types.js";

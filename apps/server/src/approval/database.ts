/**
 * Supabase テーブルの最小型定義
 * Minimal Supabase table type definitions
 * Definisi tipe tabel Supabase minimal
 */

import type { ApprovalRequestRecord, DraftRecord } from "./types.js";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type DraftInsert = {
  id?: string;
  case_handle: string;
  sha256: string;
  storage_uri?: string | null;
  status?: DraftRecord["status"];
  expires_at: string;
  created_at?: string;
  updated_at?: string;
};

type DraftUpdate = Partial<DraftInsert>;

type ApprovalRequestInsert = {
  id: string;
  draft_id: string;
  draft_sha256: string;
  principal: string;
  step: ApprovalRequestRecord["step"];
  parent_id?: string | null;
  status?: ApprovalRequestRecord["status"];
  decision?: ApprovalRequestRecord["decision"];
  idempotency_key: string;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
  decided_at?: string | null;
  trace_id?: string | null;
};

type ApprovalRequestUpdate = Partial<ApprovalRequestInsert>;

export type DocumentPackageTaskRecord = {
  id: string;
  case_handle: string;
  idempotency_key: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  result_uri: string | null;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type DocumentPackageTaskInsert = {
  id: string;
  case_handle: string;
  idempotency_key: string;
  status?: DocumentPackageTaskRecord["status"];
  result_uri?: string | null;
  error_message?: string | null;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
};

type DocumentPackageTaskUpdate = Partial<DocumentPackageTaskInsert>;

export type ApprovalDatabase = {
  public: {
    Tables: {
      drafts: {
        Row: DraftRecord;
        Insert: DraftInsert;
        Update: DraftUpdate;
        Relationships: [];
      };
      approval_requests: {
        Row: ApprovalRequestRecord;
        Insert: ApprovalRequestInsert;
        Update: ApprovalRequestUpdate;
        Relationships: [];
      };
      document_package_tasks: {
        Row: DocumentPackageTaskRecord;
        Insert: DocumentPackageTaskInsert;
        Update: DocumentPackageTaskUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type { Json };

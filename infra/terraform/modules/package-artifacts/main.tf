# GCS bucket for prepare_document_package signed-URL artifacts.
#
# Design constraints (ADR-024):
# - Objects expire after 24 h via lifecycle rule (no long-term retention).
# - Signed URLs are produced by the Cloud Run service account using V4 signing;
#   the bucket itself is private (public_access_prevention = enforced).
# - Artifact bodies contain no PII — only opaque case handles and document IDs.
# - WORM / versioning is intentionally OFF: artifacts are ephemeral drafts.

resource "google_storage_bucket" "this" {
  project                     = var.project_id
  name                        = var.bucket_name
  location                    = var.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # ADR-024: 書類パッケージ成果物は24時間で自動削除する。
  # Document package artifacts are automatically deleted after 24 hours.
  # Artefak paket dokumen dihapus otomatis setelah 24 jam.
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 1
    }
  }

  # CORS は不要 (署名 URL をクライアントに返す設計のため)。
  # Versioning OFF: 24h 単体ドラフトは履歴不要。
  versioning {
    enabled = false
  }

  labels = {
    env         = var.env
    owner       = "ssw-compass"
    cost-center = "ssw-compass-hitl"
    managed-by  = "terraform"
    purpose     = "document-package-artifacts"
  }
}

# Cloud Run runtime SA — objectAdmin で V4 署名 URL 生成に必要な
# storage.objects.create / get / delete + iam.serviceAccounts.signBlob を行う。
resource "google_storage_bucket_iam_member" "runtime_object_admin" {
  bucket = google_storage_bucket.this.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.runtime_sa_email}"
}

# V4 署名 URL 生成には Cloud Run SA 自身に対する signBlob 権限が必要。
# (roles/iam.serviceAccountTokenCreator は Storage クライアントが内部で使用)
resource "google_service_account_iam_member" "runtime_token_creator" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.runtime_sa_email}"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${var.runtime_sa_email}"
}

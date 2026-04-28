# ADR-015: Audit log 7-year retention via GCS bucket_lock + Cloud Logging sink.
#
# WARNING: is_locked=true is IRREVERSIBLE once applied.
# retention_period can only be INCREASED after locking.
# Do not apply this module without understanding the consequences.

resource "google_storage_bucket" "audit_7y" {
  name                        = var.bucket_name
  project                     = var.project_id
  location                    = "asia-northeast1"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # revision 8: 7 × 366 × 86400 = 221,184,000 seconds (leap-year-safe)
  retention_policy {
    retention_period = var.retention_seconds
    is_locked        = true
  }

  versioning {
    enabled = true
  }

  labels = {
    env         = var.env
    owner       = "ssw-compass"
    managed-by  = "terraform"
    data-class  = "audit-log"
    retention-y = "7"
  }
}

# Cloud Logging sink: export all audit_event log entries to the GCS bucket.
# unique_writer_identity=true creates a per-sink SA automatically.
# The sink's writer_identity is bound to the bucket below (sink_writer).
# No separate "logging_writer" IAM binding is required — sink_writer is sufficient.
# (Rationale: when unique_writer_identity=true the auto-created per-sink SA,
#  not the global Cloud Logging SA, writes to GCS. ADR-015.)
resource "google_logging_project_sink" "audit_sink" {
  project                = var.project_id
  name                   = "ssw-audit-to-gcs"
  destination            = "storage.googleapis.com/${google_storage_bucket.audit_7y.name}"
  description            = "ADR-015: Export SSW audit events to 7-year WORM GCS bucket."
  unique_writer_identity = true

  filter = "jsonPayload.event=\"audit_event\" AND resource.type=\"cloud_run_revision\""

  depends_on = [google_storage_bucket.audit_7y]
}

# Grant the sink's writer identity access to the bucket.
resource "google_storage_bucket_iam_member" "sink_writer" {
  bucket = google_storage_bucket.audit_7y.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.audit_sink.writer_identity
}

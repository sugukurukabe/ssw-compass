resource "google_logging_project_bucket_config" "this" {
  project        = var.project_id
  location       = var.location
  bucket_id      = var.bucket_id
  retention_days = var.retention_days
  locked         = var.locked
  description    = "SSW Compass ${var.env} log bucket. Retention ${var.retention_days}d${var.locked ? ", Bucket Lock enforced (immutable)" : ""}."
}

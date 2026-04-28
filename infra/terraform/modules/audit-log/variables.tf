variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "bucket_name" {
  description = "GCS bucket name for 7-year audit log retention. Convention: ssw-compass-audit-7y."
  type        = string
  default     = "ssw-compass-audit-7y"
}

variable "retention_seconds" {
  description = "Retention period in seconds. 221184000 = 7 × 366 × 86400 (leap-year-safe). ADR-015."
  type        = number
  default     = 221184000

  validation {
    condition     = var.retention_seconds >= 221184000
    error_message = "retention_seconds must be at least 221184000 (7 years, leap-year-safe). Cannot decrease after bucket_lock is applied."
  }
}

# logging_sa_email removed: unique_writer_identity=true creates a per-sink SA
# automatically. The sink_writer IAM binding handles bucket access.
# See ADR-015 and infra/terraform/modules/audit-log/main.tf comments.

variable "env" {
  description = "Environment label (staging/prod/shared)"
  type        = string
}

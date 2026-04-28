variable "project_id" {
  description = "GCP project ID — fixed to ssw-compass-prod-494613 for Sprint 3"
  type        = string
  default     = "ssw-compass-prod-494613"
}

variable "project_number" {
  description = "GCP project number (used in WIF principalSet)"
  type        = string
  default     = "397249937286"
}

variable "region" {
  description = "Default region"
  type        = string
  default     = "asia-northeast1"
}

variable "github_repo" {
  description = "GitHub owner/repo allowed via WIF OIDC"
  type        = string
  default     = "sugukurukabe/ssw-compass"
}

# audit_logging_sa_email removed: module.audit_log no longer requires it.
# unique_writer_identity=true in the sink auto-creates the SA. (ADR-015)

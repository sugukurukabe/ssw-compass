variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "ssw-compass-prod-494613"
}

variable "region" {
  description = "Default region"
  type        = string
  default     = "asia-northeast1"
}

variable "runtime_sa_email" {
  description = "BYOSA email — owned by envs/staging/ (ADR-009 §Sequencing). Must apply staging first."
  type        = string
  default     = "ssw-runtime@ssw-compass-prod-494613.iam.gserviceaccount.com"
}

variable "audit_logging_sa_email" {
  description = "Cloud Logging SA for audit-log GCS sink (ADR-015). Obtain with: gcloud logging sinks describe _Default --project=PROJECT --format='value(writerIdentity)'"
  type        = string
  default     = "" # Set in terraform.tfvars or via -var flag before applying module.audit_log
}

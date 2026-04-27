variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "secret_names" {
  description = "List of Secret Manager secret names to create. Naming convention (ADR-009): <service-name>-<purpose>, e.g. slack-webhook-alerts, freshness-pagerduty-key, dlp-custom-infotype-key. Empty in Batch 2."
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for n in var.secret_names : can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", n)) && length(n) <= 60])
    error_message = "Secret names must match <service>-<purpose> kebab-case (lowercase letters, digits, hyphens; start with a letter; ≤ 60 chars)."
  }
}

variable "accessor_members" {
  description = "IAM members granted roles/secretmanager.secretAccessor on every secret in this module (typically the runtime BYOSA)."
  type        = list(string)
  default     = []
}

variable "env" {
  description = "Environment label (staging/prod/shared) — attached to every secret for audit."
  type        = string
}

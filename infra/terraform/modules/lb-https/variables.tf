variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "enabled" {
  description = "Whether to create LB resources. false = no-op (sprint-4-plan §2 Batch 11 gated)."
  type        = bool
  default     = false
}

variable "name_prefix" {
  description = "Prefix for all resource names (e.g. 'ssw-prod', 'ssw-staging')"
  type        = string
  default     = "ssw-prod"
}

variable "region" {
  description = "Cloud Run service region (serverless NEG)"
  type        = string
  default     = "asia-northeast1"
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name to route traffic to (e.g. 'ssw-mcp-prod')"
  type        = string
}

variable "security_policy_id" {
  description = "Cloud Armor security policy self_link to attach. Empty string disables Cloud Armor."
  type        = string
  default     = ""
}

variable "domains" {
  description = "Domains for the Google-managed SSL certificate (e.g. ['mcp.ssw-compass.jp']). Must be DNS-verified before cert provisioning."
  type        = list(string)
  default     = []
}

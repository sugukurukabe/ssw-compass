variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "enabled" {
  description = "Skeleton gate — keep false until Batch 6 provisions Cloud Armor policy. When false, the module plans zero resources."
  type        = bool
  default     = false
}

variable "policy_name" {
  description = "Cloud Armor security policy name"
  type        = string
  default     = "ssw-waf-policy"
}

variable "mcp_rate_limit_rpm" {
  description = "Per-IP rate limit for /mcp endpoint (requests per minute)"
  type        = number
  default     = 10
}

variable "health_rate_limit_rpm" {
  description = "Per-IP rate limit for /health endpoint"
  type        = number
  default     = 100
}

variable "env" {
  description = "Environment label"
  type        = string
}

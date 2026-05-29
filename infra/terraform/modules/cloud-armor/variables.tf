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

variable "trusted_allowlist_ranges" {
  description = <<-EOT
    Source IP ranges that are always allowed and bypass geo-block + rate limiting.
    Default is Anthropic's outbound MCP egress range so Claude (web/desktop/mobile),
    which connects server-to-server from a shared NAT, is never throttled (429) or
    geo-blocked. See https://platform.claude.com/docs/en/api/ip-addresses.
    Set to [] to disable the allowlist rule.
  EOT
  type        = list(string)
  default     = ["160.79.104.0/21"]
}

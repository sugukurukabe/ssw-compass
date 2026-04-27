variable "project_id" {
  description = "GCP project ID that owns the WIF pool"
  type        = string
}

variable "pool_id" {
  description = "Workload Identity Pool ID (short name, no path)"
  type        = string
  default     = "ssw-github"
}

variable "provider_id" {
  description = "OIDC provider ID within the pool"
  type        = string
  default     = "ssw-github-oidc"
}

variable "github_repo" {
  description = "GitHub owner/repo allowed to exchange OIDC tokens (e.g., sugukurukabe/ssw-compass). Enforced via attribute condition."
  type        = string
}

variable "deploy_sa_name" {
  description = "Fully-qualified name of the SA the WIF pool can impersonate (projects/.../serviceAccounts/ssw-deploy@...)"
  type        = string
}

variable "project_id" {
  description = "GCP project ID that owns the service accounts"
  type        = string
}

variable "runtime_sa_id" {
  description = "Account ID (left part of email) for the BYOSA runtime SA"
  type        = string
  default     = "ssw-runtime"
}

variable "deploy_sa_id" {
  description = "Account ID for the CI/CD deploy SA impersonated via WIF"
  type        = string
  default     = "ssw-deploy"
}

variable "runtime_roles_always" {
  description = "Project-level roles granted to the runtime SA in every Sprint 3 batch. Least-privilege per v2 §8.2."
  type        = list(string)
  default = [
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor",
  ]
}

variable "enable_discoveryengine_viewer" {
  description = "Grant runtime SA roles/discoveryengine.viewer. Set true in Batch 4 when Vertex AI Search is provisioned."
  type        = bool
  default     = false
}

variable "enable_dlp_user" {
  description = "Grant runtime SA roles/dlp.user. Set true in Batch 5 when Cloud DLP is wired in."
  type        = bool
  default     = false
}

variable "deploy_roles" {
  description = "Project-level roles for the CI/CD deploy SA. Minimal set required to build + push + deploy Cloud Run."
  type        = list(string)
  default = [
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
  ]
}

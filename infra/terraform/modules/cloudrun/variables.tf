variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Cloud Run region (asia-northeast1)"
  type        = string
  default     = "asia-northeast1"
}

variable "service_name" {
  description = "Cloud Run v2 service name (e.g., ssw-mcp-staging, ssw-mcp-prod)"
  type        = string
}

variable "image" {
  description = "Container image reference. Batch 2 uses gcr.io/cloudrun/hello placeholder; Batch 3 swaps to asia-northeast1-docker.pkg.dev/PROJECT/ssw-images/server:SHA."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "runtime_sa_email" {
  description = "BYOSA attached to the Cloud Run service template (must NOT be the Compute default SA)."
  type        = string
}

variable "env_vars" {
  description = "Plain-text env vars (non-secret). Use secret_env_vars for sensitive values."
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret Manager secrets exposed as env vars. Map of env var name → secret name (without version). ADR-013: SSW_JWT_SECRET, future: other secrets."
  type        = map(string)
  default     = {}
}

variable "max_instances" {
  description = "Upper bound on autoscaled instance count. Staging 2, prod 20."
  type        = number
  default     = 2
}

variable "min_instances" {
  description = "Lower bound (warm) instance count. 0 saves cost but introduces cold starts."
  type        = number
  default     = 0
}

variable "concurrency" {
  description = "Max concurrent requests per instance. Cloud Run default = 80."
  type        = number
  default     = 80
}

variable "ingress" {
  description = "Cloud Run v2 ingress policy. INGRESS_TRAFFIC_ALL | INGRESS_TRAFFIC_INTERNAL_ONLY | INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
}

variable "allow_unauthenticated" {
  description = "Bind allUsers to roles/run.invoker. Staging Sprint 3 short-window true; prod false until Batch 6 Cloud Armor + Cloudflare front."
  type        = bool
  default     = false
}

variable "vpc_connector_id" {
  description = "Optional Serverless VPC Access connector for all-traffic egress. Null until Batch 6."
  type        = string
  default     = null
}

variable "cpu_limit" {
  description = "CPU limit per instance (Cloud Run syntax: \"1\", \"2\", \"1000m\")"
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit per instance (e.g., \"512Mi\", \"1Gi\")"
  type        = string
  default     = "512Mi"
}

variable "container_port" {
  description = "Port the container listens on. 8080 is the Cloud Run / distroless convention; apps/server/Dockerfile and apps/server/src/index.ts DEFAULT_PORT must match."
  type        = number
  default     = 8080
}

variable "env" {
  description = "Environment label (staging/prod) — attached to service for filtering in logs/billing."
  type        = string
}

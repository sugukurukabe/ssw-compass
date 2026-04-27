variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Log bucket location (global is default; asia-northeast1 for regional residency)"
  type        = string
  default     = "global"
}

variable "bucket_id" {
  description = "Logging bucket ID — typically _Default or a custom name per env"
  type        = string
}

variable "retention_days" {
  description = "Log retention period (days). Staging 30, prod 90."
  type        = number
}

variable "locked" {
  description = "Apply Bucket Lock (irreversible retention enforcement). True for prod, false for staging."
  type        = bool
  default     = false
}

variable "env" {
  description = "Environment label"
  type        = string
}

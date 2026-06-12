variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "GCS bucket location"
  type        = string
  default     = "asia-northeast1"
}

variable "bucket_name" {
  description = "GCS bucket name for document package artifacts (e.g. ssw-compass-packages-prod)"
  type        = string
}

variable "runtime_sa_email" {
  description = "Cloud Run runtime service account email. Granted objectAdmin on the bucket and signBlob on itself for V4 signed URL generation."
  type        = string
}

variable "env" {
  description = "Environment label (staging/prod)"
  type        = string
}

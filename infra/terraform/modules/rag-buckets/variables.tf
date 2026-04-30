variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "GCS bucket location"
  type        = string
  default     = "asia-northeast1"
}

variable "env" {
  description = "Environment label"
  type        = string
}

variable "raw_bucket_name" {
  description = "Bucket name for raw RAG documents"
  type        = string
}

variable "metadata_bucket_name" {
  description = "Bucket name for Agent Search metadata NDJSON manifests"
  type        = string
}

variable "writer_members" {
  description = "IAM members allowed to write prepared RAG documents and metadata"
  type        = list(string)
  default     = []
}

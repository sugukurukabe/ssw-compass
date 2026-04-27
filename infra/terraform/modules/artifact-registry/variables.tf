variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "AR repository location (should match Cloud Run region)"
  type        = string
  default     = "asia-northeast1"
}

variable "repository_id" {
  description = "Docker repository ID"
  type        = string
  default     = "ssw-images"
}

variable "keep_count" {
  description = "Cleanup policy — keep this many most-recent tagged images, delete older"
  type        = number
  default     = 10
}

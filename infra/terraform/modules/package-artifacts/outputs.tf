output "bucket_name" {
  description = "GCS bucket name for document package artifacts"
  value       = google_storage_bucket.this.name
}

output "bucket_url" {
  description = "gs:// URL of the artifacts bucket"
  value       = "gs://${google_storage_bucket.this.name}"
}

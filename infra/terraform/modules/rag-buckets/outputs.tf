output "raw_bucket_name" {
  description = "Raw RAG documents bucket"
  value       = google_storage_bucket.this["raw"].name
}

output "metadata_bucket_name" {
  description = "Agent Search metadata manifests bucket"
  value       = google_storage_bucket.this["metadata"].name
}

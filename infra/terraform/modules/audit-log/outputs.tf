output "bucket_name" {
  description = "GCS bucket name for the 7-year WORM audit log."
  value       = google_storage_bucket.audit_7y.name
}

output "sink_writer_identity" {
  description = "Writer identity of the Cloud Logging sink (for additional IAM bindings if needed)."
  value       = google_logging_project_sink.audit_sink.writer_identity
}

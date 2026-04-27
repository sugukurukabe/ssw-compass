output "bucket_name" {
  description = "Fully-qualified log bucket name"
  value       = google_logging_project_bucket_config.this.name
}

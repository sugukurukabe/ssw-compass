output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.this.name
}

output "service_id" {
  description = "Fully-qualified service ID"
  value       = google_cloud_run_v2_service.this.id
}

output "uri" {
  description = "Assigned run.app URL (may be null until first successful deployment)"
  value       = google_cloud_run_v2_service.this.uri
}

output "repository_id" {
  description = "Short repository ID (e.g., ssw-images)"
  value       = google_artifact_registry_repository.images.repository_id
}

output "repository_name" {
  description = "Fully-qualified resource name (projects/.../locations/.../repositories/ssw-images)"
  value       = google_artifact_registry_repository.images.name
}

output "repository_url" {
  description = "Docker pull/push URL prefix (e.g., asia-northeast1-docker.pkg.dev/PROJECT/ssw-images)"
  value       = "${var.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

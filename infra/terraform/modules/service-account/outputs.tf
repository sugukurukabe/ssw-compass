output "runtime_email" {
  description = "Email of the runtime BYOSA (attached to Cloud Run services)"
  value       = google_service_account.runtime.email
}

output "runtime_member" {
  description = "IAM member string for the runtime SA (serviceAccount:EMAIL)"
  value       = "serviceAccount:${google_service_account.runtime.email}"
}

output "runtime_name" {
  description = "Fully-qualified resource name of the runtime SA (projects/.../serviceAccounts/...)"
  value       = google_service_account.runtime.name
}

output "deploy_email" {
  description = "Email of the deploy SA (impersonated by GitHub Actions via WIF)"
  value       = google_service_account.deploy.email
}

output "deploy_name" {
  description = "Fully-qualified resource name of the deploy SA"
  value       = google_service_account.deploy.name
}

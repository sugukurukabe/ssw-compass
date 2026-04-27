output "secret_ids" {
  description = "Map of secret_name -> short secret_id (for Cloud Run volume mount reference)"
  value       = { for k, v in google_secret_manager_secret.this : k => v.secret_id }
}

output "secret_full_names" {
  description = "Map of secret_name -> fully-qualified resource name"
  value       = { for k, v in google_secret_manager_secret.this : k => v.name }
}

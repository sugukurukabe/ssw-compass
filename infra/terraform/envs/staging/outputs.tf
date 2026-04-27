output "runtime_sa_email" {
  description = "BYOSA email — attach to Cloud Run via --service-account"
  value       = module.service_account.runtime_email
}

output "runtime_sa_name" {
  description = "BYOSA fully-qualified name — prod env references this via hardcoded string (see ADR-009)"
  value       = module.service_account.runtime_name
}

output "deploy_sa_email" {
  description = "Deploy SA email — impersonated by GitHub Actions via WIF"
  value       = module.service_account.deploy_email
}

output "wif_provider_name" {
  description = "GitHub Actions WIF_PROVIDER secret value (projects/NUMBER/locations/global/workloadIdentityPools/.../providers/...)"
  value       = module.workload_identity_federation.provider_name
}

output "wif_pool_name" {
  description = "WIF pool fully-qualified name"
  value       = module.workload_identity_federation.pool_name
}

output "artifact_registry_url" {
  description = "Docker push/pull URL prefix for ssw-images repository"
  value       = module.artifact_registry.repository_url
}

output "staging_cloud_run_uri" {
  description = "Staging Cloud Run run.app URL (populated after first apply)"
  value       = module.cloud_run.uri
}

output "pool_name" {
  description = "Fully-qualified WIF pool resource name (projects/NUMBER/locations/global/workloadIdentityPools/ssw-github)"
  value       = google_iam_workload_identity_pool.this.name
}

output "provider_name" {
  description = "Fully-qualified provider resource name — use as GitHub Actions WIF_PROVIDER secret"
  value       = google_iam_workload_identity_pool_provider.github_oidc.name
}

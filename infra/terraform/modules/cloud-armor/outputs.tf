output "policy_id" {
  description = "Cloud Armor policy ID (null until enabled)"
  value       = try(google_compute_security_policy.this[0].id, null)
}

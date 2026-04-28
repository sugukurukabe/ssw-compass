output "policy_id" {
  description = "Cloud Armor policy ID (null until enabled)"
  value       = try(google_compute_security_policy.this[0].id, null)
}

output "policy_self_link" {
  description = "Cloud Armor policy self_link for backend service security_policy attachment"
  value       = try(google_compute_security_policy.this[0].self_link, "")
}

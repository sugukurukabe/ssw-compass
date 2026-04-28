output "lb_ip_address" {
  description = "Static external IP address of the Global LB. Add this as an A record for your custom domain before applying."
  value       = var.enabled ? google_compute_global_address.lb_ip[0].address : ""
}

output "backend_service_id" {
  description = "Backend service self_link (for additional health check config if needed)."
  value       = var.enabled ? google_compute_backend_service.backend[0].id : ""
}

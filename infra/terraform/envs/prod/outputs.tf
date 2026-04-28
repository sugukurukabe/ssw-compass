output "prod_cloud_run_uri" {
  description = "Prod Cloud Run run.app URL (direct, IAM-gated). Route production traffic through the LB: https://mcp.ssw-compass.jp"
  value       = module.cloud_run.uri
}

output "lb_ip_address" {
  description = "Global LB static IP — set mcp.ssw-compass.jp A record to this value in Cloudflare."
  value       = module.lb.lb_ip_address
}

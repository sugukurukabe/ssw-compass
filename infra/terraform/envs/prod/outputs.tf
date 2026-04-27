output "prod_cloud_run_uri" {
  description = "Prod Cloud Run run.app URL (populated after first apply). INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER until Batch 6."
  value       = module.cloud_run.uri
}

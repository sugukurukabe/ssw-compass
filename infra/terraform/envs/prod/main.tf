provider "google" {
  project = var.project_id
  region  = var.region
}

module "cloud_run" {
  source                = "../../modules/cloudrun"
  project_id            = var.project_id
  location              = var.region
  service_name          = "ssw-mcp-prod"
  image                 = "gcr.io/cloudrun/hello"
  runtime_sa_email      = var.runtime_sa_email
  max_instances         = 20
  min_instances         = 0
  concurrency           = 80
  ingress               = "INGRESS_TRAFFIC_ALL" # Batch 6: opened post-Cloud-Armor definition; auth still required
  allow_unauthenticated = false
  env                   = "prod"
  env_vars = {
    SSW_ENV          = "prod"
    SSW_VERTEX_MODE  = "real"
    LOG_LEVEL        = "info"
    SSW_BUILD_SOURCE = "sprint4-batch2-auth"
    SSW_AUTH_MODE    = "jwt"
  }
  # ADR-013: SSW_JWT_SECRET from Secret Manager (same secret name as staging).
  # Create before first prod deploy (Batch 11).
  secret_env_vars = {
    SSW_JWT_SECRET = "ssw-jwt-secret"
  }
}

module "logging" {
  source         = "../../modules/logging"
  project_id     = var.project_id
  bucket_id      = "ssw-logs-prod"
  retention_days = 90
  locked         = true
  env            = "prod"
}

module "vertex_ai_search" {
  source     = "../../modules/vertex-ai-search"
  project_id = var.project_id
  location   = var.region
  enabled    = false
}

module "vpc_egress" {
  source     = "../../modules/vpc-egress"
  project_id = var.project_id
  region     = var.region
  enabled    = false
  env        = "prod"
}

module "cloud_armor" {
  source     = "../../modules/cloud-armor"
  project_id = var.project_id
  enabled    = false
  env        = "prod"
}

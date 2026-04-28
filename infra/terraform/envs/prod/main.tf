provider "google" {
  project = var.project_id
  region  = var.region
  # discoveryengine requires explicit quota project with user ADC (same as staging)
  user_project_override = true
  billing_project       = var.project_id
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
  ingress               = "INGRESS_TRAFFIC_ALL" # auth required via IAM (allow_unauthenticated=false)
  allow_unauthenticated = false
  env                   = "prod"
  env_vars = {
    SSW_ENV               = "prod"
    SSW_VERTEX_MODE       = "fixture" # flip to "real" in Batch 5 (Sprint 4 Phase 1)
    LOG_LEVEL             = "info"
    SSW_BUILD_SOURCE      = "sprint4-batch11-prod-deploy"
    SSW_AUTH_MODE         = "jwt"
    DLP_ENABLED           = "true" # ADR-011: LIKELY threshold, safe for prod
    CLOUDSDK_CORE_PROJECT = var.project_id
  }
  # ADR-013: SSW_JWT_SECRET from Secret Manager.
  # gcloud secrets create ssw-jwt-secret --project=PROJECT_ID
  # printf '%s' "$(openssl rand -base64 48)" | gcloud secrets versions add ssw-jwt-secret --data-file=- --project=PROJECT_ID
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

# ADR-015: 7-year WORM audit log bucket.
# ⚠️ is_locked=true is IRREVERSIBLE — run terraform plan first.
# No logging_sa_email needed: unique_writer_identity=true auto-creates a per-sink SA.
module "audit_log" {
  source      = "../../modules/audit-log"
  project_id  = var.project_id
  bucket_name = "ssw-compass-audit-7y"
  env         = "prod"
}

module "vertex_ai_search" {
  source     = "../../modules/vertex-ai-search"
  project_id = var.project_id
  location   = var.region
  enabled    = true # data stores mirror staging (Batch 5 will ingest content)
}

module "vpc_egress" {
  source     = "../../modules/vpc-egress"
  project_id = var.project_id
  region     = var.region
  enabled    = true # same VPC + NAT configuration as staging
  env        = "prod"
}

module "cloud_armor" {
  source     = "../../modules/cloud-armor"
  project_id = var.project_id
  enabled    = true # policy defined; attached to LB below
  env        = "prod"
}

# Global HTTPS LB + Cloud Armor attach (ADR-012 §Decision 1)
# ⚠️ Pre-apply checklist (see docs/deploy-runbook.md §Batch 11):
#   1. DNS cut-over: mcp.ssw-compass.jp A → output.lb_ip_address
#   2. ssw-jwt-secret in Secret Manager (prod)
#   3. Run terraform apply -target=module.cloud_run FIRST, then
#      terraform apply -target=module.lb (so NEG can reference the running service)
module "lb" {
  source                 = "../../modules/lb-https"
  project_id             = var.project_id
  region                 = var.region
  enabled                = true
  name_prefix            = "ssw-prod"
  cloud_run_service_name = "ssw-mcp-prod"
  security_policy_id     = module.cloud_armor.policy_self_link
  domains                = ["mcp.ssw-compass.jp"]

  depends_on = [module.cloud_run, module.cloud_armor]
}

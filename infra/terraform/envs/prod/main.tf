provider "google" {
  project = var.project_id
  region  = var.region
  # discoveryengine requires explicit quota project with user ADC (same as staging)
  user_project_override = true
  billing_project       = var.project_id
}

module "cloud_run" {
  source           = "../../modules/cloudrun"
  project_id       = var.project_id
  location         = var.region
  service_name     = "ssw-mcp-prod"
  image            = "gcr.io/cloudrun/hello"
  runtime_sa_email = var.runtime_sa_email
  max_instances    = 20
  min_instances    = 0
  concurrency      = 80
  ingress          = "INGRESS_TRAFFIC_ALL"
  # allow_unauthenticated=true: LB + Cloud Armor (ssw-waf-policy-prod) protect the service.
  # Application-layer auth (SSW_AUTH_MODE=jwt) distinguishes Free/Pro tiers.
  # See ADR-013 §Cloud Run ingress for the auth layering rationale.
  allow_unauthenticated = true
  env                   = "prod"
  env_vars = {
    SSW_ENV                      = "prod"
    SSW_VERTEX_MODE              = "real"
    SSW_VERTEX_PROJECT           = "ssw-compass-prod-494613"
    SSW_VERTEX_LOCATION          = "asia-northeast1"
    SSW_VERTEX_COLLECTION        = "default_collection"
    SSW_VERTEX_DATA_STORE_ID     = "visa_legal"
    SSW_VERTEX_SERVING_CONFIG_ID = "default_config"
    # DLP_ENABLED temporarily false on prod: fail-closed DLP API errors block all
    # search_visa queries (same issue as staging Sprint 3 Batch 6).
    # Diagnosis: ssw-runtime SA may lack roles/dlp.user in prod context, or
    # DLP API quota is being exceeded. Sprint 5 Phase B task: diagnose and re-enable.
    # ADR-011: DLP re-enabled. IAM confirmed OK (roles/dlp.user on ssw-runtime SA).
    # Sprint 4 failure was likely DLP API cold-start on first prod request.
    DLP_ENABLED           = "true"
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
  enabled    = true
  env        = "prod"
  # Use prod-specific names to avoid 409 conflict with staging resources
  # (both staging and prod share the same GCP project ssw-compass-prod-494613)
  network_name = "ssw-vpc-prod"
}

module "cloud_armor" {
  source     = "../../modules/cloud-armor"
  project_id = var.project_id
  enabled    = true
  env        = "prod"
  # Use prod-specific policy name to avoid 409 conflict with staging's ssw-waf-policy
  policy_name = "ssw-waf-policy-prod"

  # Anthropic / OpenAI のクラウドインフラは Claude.ai / ChatGPT の全ユーザー
  # で NAT IP を共有するため、10 rpm/IP だと一瞬で 429 を返してしまう。
  # 本番は 600 rpm (10 rps) = 1 IP あたり同時 60 ユーザーセッションを許容。
  # DDoS 耐性は Cloud Armor Standard の標準機能 + Cloud Run autoscaling で担保。
  mcp_rate_limit_rpm = 600
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

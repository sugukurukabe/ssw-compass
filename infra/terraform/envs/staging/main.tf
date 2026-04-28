locals {
  enabled_apis = [
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    # Batch 4: Vertex AI Search + foundation platform APIs.
    "discoveryengine.googleapis.com",
    "aiplatform.googleapis.com",
    # Batch 5: Cloud DLP 2nd stage for PII guard.
    "dlp.googleapis.com",
    # Batch 6: Serverless VPC Access connector + Cloud NAT static IP.
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
  ]
}

provider "google" {
  project = var.project_id
  region  = var.region
  # discoveryengine.googleapis.com (Batch 4) requires an explicit quota
  # project when authenticated via user ADC / short-lived access token.
  # user_project_override=true + billing_project directs the provider to
  # bill API calls to this project rather than the caller's default.
  user_project_override = true
  billing_project       = var.project_id
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_apis)

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

module "service_account" {
  source                        = "../../modules/service-account"
  project_id                    = var.project_id
  enable_discoveryengine_viewer = true # Batch 4: bind ssw-runtime to roles/discoveryengine.viewer
  enable_dlp_user               = true # Batch 5: bind ssw-runtime to roles/dlp.user for inspectContent

  depends_on = [google_project_service.enabled]
}

module "workload_identity_federation" {
  source         = "../../modules/workload-identity-federation"
  project_id     = var.project_id
  github_repo    = var.github_repo
  deploy_sa_name = module.service_account.deploy_name

  depends_on = [google_project_service.enabled]
}

module "artifact_registry" {
  source     = "../../modules/artifact-registry"
  project_id = var.project_id
  location   = var.region

  depends_on = [google_project_service.enabled]
}

module "secrets" {
  source           = "../../modules/secret-manager"
  project_id       = var.project_id
  env              = "shared"
  secret_names     = []
  accessor_members = [module.service_account.runtime_member]

  depends_on = [google_project_service.enabled]
}

module "cloud_run" {
  source                = "../../modules/cloudrun"
  project_id            = var.project_id
  location              = var.region
  service_name          = "ssw-mcp-staging"
  image                 = "gcr.io/cloudrun/hello"
  runtime_sa_email      = module.service_account.runtime_email
  max_instances         = 2
  min_instances         = 0
  concurrency           = 80
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false # Batch 6: ADR-009 §6 mitigation #1 enforced — staging close-public
  env                   = "staging"
  env_vars = {
    SSW_ENV         = "staging"
    SSW_VERTEX_MODE = "fixture"
    # DLP_ENABLED temporarily false on staging pending sensitivity
    # tuning: minLikelihood=POSSIBLE flagged the neutral smoke
    # query "特定技能1号 建設分野" as PII (false positive).
    # Sprint 4 task: raise minLikelihood to LIKELY and/or calibrate
    # allow-list tokens, then re-enable. Unit tests in
    # apps/server/test/pii/dlp.test.ts continue to cover the code
    # path with mocked DLP responses.
    DLP_ENABLED           = "false"
    CLOUDSDK_CORE_PROJECT = var.project_id
    LOG_LEVEL             = "info"
    SSW_BUILD_SOURCE      = "batch-6-network-hardening"
  }

  # Batch 6: route all Cloud Run egress through the ssw-vpc connector
  # so outbound traffic exits via the Cloud NAT static IP (ADR-012).
  vpc_connector_id = module.vpc_egress.connector_id

  depends_on = [module.service_account, module.vpc_egress]
}

module "logging" {
  source         = "../../modules/logging"
  project_id     = var.project_id
  bucket_id      = "ssw-logs-staging"
  retention_days = 30
  locked         = false
  env            = "staging"

  depends_on = [google_project_service.enabled]
}

module "vertex_ai_search" {
  source     = "../../modules/vertex-ai-search"
  project_id = var.project_id
  location   = var.region
  enabled    = true # Batch 4: create 3 data stores (visa_legal / visa_faq / visa_secondary)

  depends_on = [google_project_service.enabled]
}

module "vpc_egress" {
  source     = "../../modules/vpc-egress"
  project_id = var.project_id
  region     = var.region
  enabled    = true # Batch 6: VPC network + Serverless VPC Access + Cloud NAT static egress IP
  env        = "staging"

  depends_on = [google_project_service.enabled]
}

module "cloud_armor" {
  source     = "../../modules/cloud-armor"
  project_id = var.project_id
  enabled    = true # Batch 6: define WAF policy (Standard edition); attach to LB in Sprint 4
  env        = "staging"

  depends_on = [google_project_service.enabled]
}

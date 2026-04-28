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
  allow_unauthenticated = true
  env                   = "staging"
  env_vars = {
    SSW_ENV          = "staging"
    SSW_VERTEX_MODE  = "fixture"
    DLP_ENABLED      = "true" # Batch 5: activate Cloud DLP 2nd stage in pii/index.ts
    LOG_LEVEL        = "info"
    SSW_BUILD_SOURCE = "batch-5-sanitizer-dlp"
  }

  depends_on = [module.service_account]
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
  enabled    = false
  env        = "staging"
}

module "cloud_armor" {
  source     = "../../modules/cloud-armor"
  project_id = var.project_id
  enabled    = false
  env        = "staging"
}

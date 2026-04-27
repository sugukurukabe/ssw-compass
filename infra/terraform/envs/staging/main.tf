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
  ]
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "enabled" {
  for_each = toset(local.enabled_apis)

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

module "service_account" {
  source     = "../../modules/service-account"
  project_id = var.project_id

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
    LOG_LEVEL        = "info"
    SSW_BUILD_SOURCE = "batch-2-placeholder"
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
  enabled    = false
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

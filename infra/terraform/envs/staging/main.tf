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
  source     = "../../modules/secret-manager"
  project_id = var.project_id
  env        = "shared"
  # ADR-013: ssw-jwt-secret holds the HS256 signing key for application-layer
  # JWT auth (Path Y). Value set manually:
  #   gcloud secrets create ssw-jwt-secret --project=PROJECT_ID
  #   echo -n "$(openssl rand -base64 48)" | \
  #     gcloud secrets versions add ssw-jwt-secret --data-file=- --project=PROJECT_ID
  # Rotation is operational; Terraform only declares the secret name.
  secret_names     = ["ssw-jwt-secret"]
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
    # ADR-011: DLP re-enabled with minLikelihood=LIKELY (4).
    # Sprint 3 false-positive (POSSIBLE flagging "特定技能1号 建設分野") is
    # resolved by raising the threshold. EMAIL_ADDRESS/PHONE_NUMBER/IBAN_CODE
    # removed from BLOCKING_INFO_TYPES in dlp-config.ts.
    DLP_ENABLED           = "true"
    CLOUDSDK_CORE_PROJECT = var.project_id
    LOG_LEVEL             = "info"
    SSW_BUILD_SOURCE      = "sprint4-batch2-auth"
    # ADR-013: SSW_AUTH_MODE controls the auth path.
    # "jwt" = Path Y (HS256 JWT self-verify, requires SSW_JWT_SECRET).
    # "anonymous" = bypass all auth (local dev only, must NOT be used in staging/prod).
    SSW_AUTH_MODE = "jwt"
  }
  # ADR-013: SSW_JWT_SECRET injected from Secret Manager at deploy time.
  # The secret must be created before terraform apply:
  #   gcloud secrets create ssw-jwt-secret --project=$PROJECT_ID
  #   echo -n "$(openssl rand -base64 48)" | \
  #     gcloud secrets versions add ssw-jwt-secret --data-file=- --project=$PROJECT_ID
  secret_env_vars = {
    SSW_JWT_SECRET = "ssw-jwt-secret"
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

# ADR-015: 7-year WORM audit log bucket (bucket_lock irreversible).
# Cloud Logging sink filter: jsonPayload.event="audit_event"
module "audit_log" {
  source      = "../../modules/audit-log"
  project_id  = var.project_id
  bucket_name = "ssw-compass-audit-7y"
  env         = "staging"
  # No logging_sa_email needed: unique_writer_identity=true auto-creates a per-sink SA.
  # The sink_writer IAM binding is handled inside the module. (ADR-015)

  depends_on = [google_project_service.enabled]
}

module "rag_buckets" {
  source               = "../../modules/rag-buckets"
  project_id           = var.project_id
  location             = var.region
  env                  = "staging"
  raw_bucket_name      = "ssw-compass-rag-raw-staging"
  metadata_bucket_name = "ssw-compass-rag-metadata-staging"
  writer_members = [
    module.service_account.runtime_member,
    "serviceAccount:${module.service_account.deploy_email}",
  ]

  depends_on = [google_project_service.enabled, module.service_account]
}

module "vertex_ai_search" {
  source               = "../../modules/vertex-ai-search"
  project_id           = var.project_id
  location             = var.region
  enabled              = true # Batch 4: create 3 data stores (visa_legal / visa_faq / visa_secondary)
  enable_rag_v2_stores = true

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

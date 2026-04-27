resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_sa_id
  display_name = "SSW Compass runtime (BYOSA) — Cloud Run attach target"
  description  = "Least-privilege SA attached to ssw-mcp Cloud Run services. Roles granted via google_project_iam_member only — never roles/editor, roles/owner, or *Admin."
}

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = var.deploy_sa_id
  display_name = "SSW Compass deploy (WIF consumer) — GitHub Actions impersonation target"
  description  = "Impersonated by GitHub Actions via Workload Identity Federation. Granted run.admin + cloudbuild.builds.editor + artifactregistry.writer + iam.serviceAccountUser to act on ssw-runtime."
}

resource "google_project_iam_member" "runtime_always" {
  for_each = toset(var.runtime_roles_always)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_discoveryengine" {
  count = var.enable_discoveryengine_viewer ? 1 : 0

  project = var.project_id
  role    = "roles/discoveryengine.viewer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_dlp" {
  count = var.enable_dlp_user ? 1 : 0

  project = var.project_id
  role    = "roles/dlp.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "deploy" {
  for_each = toset(var.deploy_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  location            = var.location
  name                = var.service_name
  ingress             = var.ingress
  deletion_protection = false

  labels = {
    env        = var.env
    owner      = "ssw-compass"
    managed-by = "terraform"
  }

  template {
    service_account                  = var.runtime_sa_email
    max_instance_request_concurrency = var.concurrency
    # MCP Streamable HTTP のセッションはインスタンスのメモリ上に保持されるため、
    # スケール時に initialize と tools/list が別インスタンスへ振られないよう
    # session affinity を有効化する (best-effort)。
    session_affinity = var.session_affinity

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret Manager env vars — ADR-013: SSW_JWT_SECRET injected here.
      # Value pulled from latest version at deploy time (no :latest tag drift
      # because Cloud Run pins the resolved version in the revision spec).
      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      ports {
        container_port = var.container_port
      }
    }

    dynamic "vpc_access" {
      for_each = var.vpc_connector_id == null ? [] : [1]
      content {
        connector = var.vpc_connector_id
        egress    = "ALL_TRAFFIC"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].annotations["run.googleapis.com/operation-id"],
      # ADR-009 judgment 1 (gcloud-managed image): the image tag is
      # rotated by `gcloud run deploy --image=...` from GitHub Actions
      # on every main push. Terraform state stays pinned to whatever
      # value was supplied at last apply. `terraform plan` must NOT
      # show an image diff after a gcloud-driven deploy — if it does,
      # this ignore_changes entry has drifted and must be restored
      # before the next terraform apply.
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

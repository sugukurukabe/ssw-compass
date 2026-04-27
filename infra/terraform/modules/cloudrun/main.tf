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

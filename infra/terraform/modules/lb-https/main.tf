# Global HTTPS Load Balancer + Cloud Armor attach (ADR-012 §Decision 1 / sprint-4-plan §2 Batch 11)
#
# Architecture:
#   Client → Google Global LB → Cloud Armor (ssw-waf-policy) → Cloud Run prod
#
# Cloud Run is IAM-gated (allow_unauthenticated=false).
# The LB uses a serverless NEG (Network Endpoint Group) pointing to Cloud Run.
# TLS is terminated at the LB using a Google-managed SSL certificate.
#
# mcp.ssw-compass.jp DNS must point to the LB's external IP *before* applying
# the managed certificate block — otherwise certificate provisioning fails.
# See docs/deploy-runbook.md §Batch 11 for the DNS cut-over runbook.

# Static global IP
resource "google_compute_global_address" "lb_ip" {
  count   = var.enabled ? 1 : 0
  name    = "${var.name_prefix}-lb-ip"
  project = var.project_id
}

# Serverless NEG → Cloud Run prod
resource "google_compute_region_network_endpoint_group" "cloud_run_neg" {
  count                 = var.enabled ? 1 : 0
  name                  = "${var.name_prefix}-neg"
  project               = var.project_id
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_service_name
  }
}

# Backend service — attaches NEG + Cloud Armor policy
resource "google_compute_backend_service" "backend" {
  count                 = var.enabled ? 1 : 0
  name                  = "${var.name_prefix}-backend"
  project               = var.project_id
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  security_policy       = var.security_policy_id
  enable_cdn            = false
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.cloud_run_neg[0].id
  }
}

# URL map — all traffic to the Cloud Run backend
resource "google_compute_url_map" "url_map" {
  count           = var.enabled ? 1 : 0
  name            = "${var.name_prefix}-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.backend[0].id
}

# HTTP → HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  count   = var.enabled ? 1 : 0
  name    = "${var.name_prefix}-https-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    strip_query            = false
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
  }
}

# Google-managed SSL certificate for the custom domain
resource "google_compute_managed_ssl_certificate" "cert" {
  count   = var.enabled && length(var.domains) > 0 ? 1 : 0
  name    = "${var.name_prefix}-cert"
  project = var.project_id

  managed {
    domains = var.domains
  }
}

# HTTPS target proxy
resource "google_compute_target_https_proxy" "https_proxy" {
  count   = var.enabled ? 1 : 0
  name    = "${var.name_prefix}-https-proxy"
  project = var.project_id
  url_map = google_compute_url_map.url_map[0].id
  ssl_certificates = var.enabled && length(var.domains) > 0 ? [
    google_compute_managed_ssl_certificate.cert[0].id
  ] : []
}

# HTTP target proxy (for redirect)
resource "google_compute_target_http_proxy" "http_proxy" {
  count   = var.enabled ? 1 : 0
  name    = "${var.name_prefix}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.https_redirect[0].id
}

# HTTPS forwarding rule
resource "google_compute_global_forwarding_rule" "https_rule" {
  count                 = var.enabled ? 1 : 0
  name                  = "${var.name_prefix}-https-fwd"
  project               = var.project_id
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb_ip[0].address
  port_range            = "443"
  target                = google_compute_target_https_proxy.https_proxy[0].id
}

# HTTP forwarding rule (redirect to HTTPS)
resource "google_compute_global_forwarding_rule" "http_rule" {
  count                 = var.enabled ? 1 : 0
  name                  = "${var.name_prefix}-http-fwd"
  project               = var.project_id
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb_ip[0].address
  port_range            = "80"
  target                = google_compute_target_http_proxy.http_proxy[0].id
}

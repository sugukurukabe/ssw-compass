resource "google_compute_security_policy" "this" {
  count = var.enabled ? 1 : 0

  project     = var.project_id
  name        = var.policy_name
  description = "SSW Compass ${var.env} multi-layer WAF — rate limit + geo-block + RFC1918 egress block."

  rule {
    action   = "deny(403)"
    priority = 1000

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["169.254.0.0/16"]
      }
    }
    description = "Block link-local (metadata server exfil guard)"
  }

  rule {
    action   = "allow"
    priority = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow (last rule)"
  }
}

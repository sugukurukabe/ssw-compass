resource "google_compute_security_policy" "this" {
  count = var.enabled ? 1 : 0

  project     = var.project_id
  name        = var.policy_name
  description = "SSW Compass ${var.env} multi-layer WAF — rate limit + geo-block + RFC1918 egress block. Standard edition (ADR-012)."
  type        = "CLOUD_ARMOR"

  # Priority 500 — geo-block high-risk countries. Cloud Armor CEL
  # does not support the `in [...]` operator; use chained `==`.
  rule {
    action      = "deny(403)"
    priority    = 500
    description = "Geo-block CN/RU/KP/IR (ADR-012 §Decision 2)"

    match {
      expr {
        expression = "origin.region_code == 'CN' || origin.region_code == 'RU' || origin.region_code == 'KP' || origin.region_code == 'IR'"
      }
    }
  }

  # Priority 900 — RFC1918 + link-local source block (SSRF / metadata exfil guard).
  rule {
    action      = "deny(403)"
    priority    = 900
    description = "Block RFC1918 + link-local source ranges"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = [
          "10.0.0.0/8",
          "172.16.0.0/12",
          "192.168.0.0/16",
          "169.254.0.0/16",
        ]
      }
    }
  }

  # Priority 1000 — /mcp endpoint throttle (10 req/min/IP).
  rule {
    action      = "throttle"
    priority    = 1000
    description = "Rate limit /mcp — 10 req/min/IP"

    match {
      expr {
        expression = "request.path.startsWith('/mcp')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = var.mcp_rate_limit_rpm
        interval_sec = 60
      }
    }
  }

  # Priority 1100 — /health throttle (100 req/min/IP).
  rule {
    action      = "throttle"
    priority    = 1100
    description = "Rate limit /health — 100 req/min/IP"

    match {
      expr {
        expression = "request.path.startsWith('/health')"
      }
    }

    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = var.health_rate_limit_rpm
        interval_sec = 60
      }
    }
  }

  # Default — allow everything else (terminal rule).
  rule {
    action      = "allow"
    priority    = 2147483647
    description = "Default allow (last rule)"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

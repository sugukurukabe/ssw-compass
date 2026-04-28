resource "google_discovery_engine_data_store" "this" {
  for_each = var.enabled ? toset(var.data_stores) : []

  project                     = var.project_id
  location                    = var.location
  data_store_id               = each.value
  display_name                = "SSW Compass ${each.value}"
  industry_vertical           = "GENERIC"
  content_config              = "CONTENT_REQUIRED"
  solution_types              = ["SOLUTION_TYPE_SEARCH"]
  create_advanced_site_search = false

  # Discovery Engine auto-populates document_processing_config.default_parsing_config
  # after the data store becomes ACTIVE. Ignoring this block prevents a
  # destructive replace whenever the google provider's schema gains new
  # nested fields (observed on a provider upgrade between Batch 4 Day 1
  # and Batch 5 Day 1 — 7.29.x -> 7.y.z added digital_parsing_config).
  # This is a state-only drift; the actual GCP resource is unchanged.
  lifecycle {
    ignore_changes = [document_processing_config]
  }
}

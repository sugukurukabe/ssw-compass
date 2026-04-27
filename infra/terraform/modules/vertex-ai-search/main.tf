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
}

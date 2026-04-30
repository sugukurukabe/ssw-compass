output "data_store_ids" {
  description = "Map of data_store_id -> full resource name (empty map until enabled)"
  value = merge(
    { for k, v in google_discovery_engine_data_store.this : k => v.name },
    { for k, v in google_discovery_engine_data_store.rag_v2 : k => v.name },
  )
}

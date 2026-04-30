variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Vertex AI Search data store location"
  type        = string
  default     = "asia-northeast1"
}

variable "enabled" {
  description = "Skeleton gate — keep false until Batch 4 provisions data stores. When false, the module plans zero resources."
  type        = bool
  default     = false
}

variable "collection_id" {
  description = "Discovery Engine collection ID"
  type        = string
  default     = "default_collection"
}

variable "data_stores" {
  description = "Data store IDs to create when enabled. Fixed-set: visa_legal (primary), visa_faq (secondary), visa_secondary (fallback)."
  type        = list(string)
  default     = ["visa_legal", "visa_faq", "visa_secondary"]
}

variable "enable_rag_v2_stores" {
  description = "Create v2 chunked Agent Search data stores for GCS-backed RAG ingestion."
  type        = bool
  default     = false
}

variable "rag_v2_data_stores" {
  description = "Chunked v2 Agent Search data store IDs."
  type        = list(string)
  default     = ["visa_legal_core_v2", "visa_forms_v2", "visa_faq_v2", "visa_law_updates_v2"]
}

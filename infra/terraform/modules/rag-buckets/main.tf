locals {
  buckets = {
    raw      = var.raw_bucket_name
    metadata = var.metadata_bucket_name
  }
}

resource "google_storage_bucket" "this" {
  for_each = local.buckets

  project                     = var.project_id
  name                        = each.value
  location                    = var.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      days_since_noncurrent_time = 90
      with_state                 = "ARCHIVED"
    }
  }

  labels = {
    env         = var.env
    owner       = "ssw-compass"
    cost-center = "ssw-compass-rag"
    managed-by  = "terraform"
    purpose     = each.key == "raw" ? "rag-raw-documents" : "rag-metadata"
  }
}

resource "google_storage_bucket_iam_member" "writer" {
  for_each = {
    for pair in setproduct(keys(local.buckets), var.writer_members) :
    "${pair[0]}|${pair[1]}" => {
      bucket_key = pair[0]
      member     = pair[1]
    }
  }

  bucket = google_storage_bucket.this[each.value.bucket_key].name
  role   = "roles/storage.objectAdmin"
  member = each.value.member
}

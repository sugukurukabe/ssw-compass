terraform {
  backend "gcs" {
    bucket = "ssw-compass-tf-state"
    prefix = "staging"
  }
}

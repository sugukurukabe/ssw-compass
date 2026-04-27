terraform {
  backend "gcs" {
    bucket = "ssw-compass-tf-state"
    prefix = "prod"
  }
}

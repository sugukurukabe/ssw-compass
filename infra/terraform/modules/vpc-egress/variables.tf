variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Region for VPC network + NAT + connector"
  type        = string
  default     = "asia-northeast1"
}

variable "enabled" {
  description = "Skeleton gate — keep false until Batch 6 provisions egress controls. When false, the module plans zero resources."
  type        = bool
  default     = false
}

variable "network_name" {
  description = "VPC network name"
  type        = string
  default     = "ssw-vpc"
}

variable "subnet_cidr" {
  description = "CIDR block for the egress-only subnet"
  type        = string
  default     = "10.20.0.0/24"
}

variable "connector_cidr" {
  description = "Serverless VPC Access connector /28 range"
  type        = string
  default     = "10.20.1.0/28"
}

variable "env" {
  description = "Environment label"
  type        = string
}

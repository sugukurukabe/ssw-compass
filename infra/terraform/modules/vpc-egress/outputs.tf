output "connector_id" {
  description = "Serverless VPC Access connector ID (null until enabled)"
  value       = try(google_vpc_access_connector.this[0].id, null)
}

output "nat_ip" {
  description = "Static egress NAT IP (null until enabled)"
  value       = try(google_compute_address.nat_ip[0].address, null)
}

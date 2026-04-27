resource "google_compute_network" "this" {
  count = var.enabled ? 1 : 0

  project                 = var.project_id
  name                    = var.network_name
  auto_create_subnetworks = false
  description             = "SSW Compass ${var.env} egress-only VPC. All Cloud Run egress routes through Cloud NAT static IP."
}

resource "google_compute_subnetwork" "egress" {
  count = var.enabled ? 1 : 0

  project                  = var.project_id
  name                     = "${var.network_name}-egress"
  network                  = google_compute_network.this[0].id
  region                   = var.region
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}

resource "google_vpc_access_connector" "this" {
  count = var.enabled ? 1 : 0

  project        = var.project_id
  name           = "${var.network_name}-connector"
  region         = var.region
  ip_cidr_range  = var.connector_cidr
  network        = google_compute_network.this[0].name
  min_throughput = 200
  max_throughput = 300
}

resource "google_compute_router" "nat" {
  count = var.enabled ? 1 : 0

  project = var.project_id
  name    = "${var.network_name}-router"
  region  = var.region
  network = google_compute_network.this[0].id
}

resource "google_compute_address" "nat_ip" {
  count = var.enabled ? 1 : 0

  project      = var.project_id
  name         = "${var.network_name}-nat-ip"
  region       = var.region
  address_type = "EXTERNAL"
}

resource "google_compute_router_nat" "this" {
  count = var.enabled ? 1 : 0

  project                            = var.project_id
  name                               = "${var.network_name}-nat"
  router                             = google_compute_router.nat[0].name
  region                             = var.region
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [google_compute_address.nat_ip[0].self_link]
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

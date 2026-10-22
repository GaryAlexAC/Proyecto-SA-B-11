resource "google_compute_network" "vpc" {
  name                    = "bank-usac-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gke_subnet" {
  name          = "bank-usac-gke-subnet"
  ip_cidr_range = "10.10.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "gke-pods-range"
    ip_cidr_range = "10.20.0.0/16"
  }

  secondary_ip_range {
    range_name    = "gke-services-range"
    ip_cidr_range = "10.30.0.0/20"
  }
}

resource "google_compute_subnetwork" "db_subnet" {
  name          = "bank-usac-db-subnet"
  ip_cidr_range = "10.10.16.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

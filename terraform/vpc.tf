# ============================================================
# VPC Network
# ============================================================
resource "google_compute_network" "main" {
  name                    = "bank-usac-vpc"
  auto_create_subnetworks = false
}

# Subnet para los pods de GKE
resource "google_compute_subnetwork" "gke" {
  name          = "bank-usac-gke-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.main.id

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.4.0.0/14"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "10.8.0.0/20"
  }
}

# Subnet para la VM de base de datos
resource "google_compute_subnetwork" "db" {
  name          = "bank-usac-db-subnet"
  ip_cidr_range = "10.1.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

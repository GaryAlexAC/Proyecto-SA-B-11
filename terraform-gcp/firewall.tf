# Permitir comunicación interna total entre GKE (Pods y Services) y la VM de Base de Datos
resource "google_compute_firewall" "allow_internal" {
  name    = "bank-usac-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [
    "10.10.0.0/16",
    "10.20.0.0/16",
    "10.30.0.0/16",
  ]
}

# Permitir SSH (puerto 22) hacia la máquina de Base de Datos (para túnel de DBeaver)
resource "google_compute_firewall" "allow_ssh" {
  name    = "bank-usac-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["database-server"]
}

# Permitir conexión a PostgreSQL (5432) desde la VPC
resource "google_compute_firewall" "allow_postgres" {
  name    = "bank-usac-allow-postgres"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["database-server"]
}

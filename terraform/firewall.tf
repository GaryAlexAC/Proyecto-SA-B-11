# ============================================================
# Firewall Rules
# ============================================================

# Permitir tráfico interno entre nodos del cluster y la VM de BD
resource "google_compute_firewall" "allow_internal" {
  name    = "bank-usac-allow-internal"
  network = google_compute_network.main.id

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

  source_ranges = ["10.0.0.0/8"]
}

# Permitir acceso SSH a la VM de BD (para administración inicial)
resource "google_compute_firewall" "allow_ssh" {
  name    = "bank-usac-allow-ssh"
  network = google_compute_network.main.id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["bank-usac-db"]
}

# Permitir acceso a PostgreSQL desde el cluster GKE
resource "google_compute_firewall" "allow_postgres" {
  name    = "bank-usac-allow-postgres"
  network = google_compute_network.main.id

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  # Solo desde la subnet de GKE y sus pods
  source_ranges = ["10.0.0.0/20", "10.4.0.0/14"]
  target_tags   = ["bank-usac-db"]
}

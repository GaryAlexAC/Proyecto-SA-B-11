# ============================================================
# Compute Engine VM — Base de datos PostgreSQL
# ============================================================
resource "google_compute_instance" "database" {
  name         = "bank-usac-db"
  machine_type = "e2-medium"
  zone         = var.zone
  tags         = ["bank-usac-db"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 30 # GB
      type  = "pd-standard"
    }
  }

  network_interface {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.db.id

    # IP pública temporal para la instalación inicial
    # En producción real se eliminaría y se usaría IAP o VPN
    access_config {}
  }

  metadata = {
    startup-script = templatefile("${path.module}/scripts/setup-postgres.sh", {
      DB_PASSWORD   = var.db_password
      DB_ADMIN_USER = var.db_admin_user
    })
  }

  lifecycle {
    prevent_destroy = false
  }
}

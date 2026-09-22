# ============================================================
# GKE Autopilot Cluster
# ============================================================
resource "google_container_cluster" "main" {
  name     = "bank-usac-cluster"
  location = var.region

  # Autopilot maneja los nodos automáticamente (más barato para demos)
  enable_autopilot = true

  network    = google_compute_network.main.id
  subnetwork = google_compute_subnetwork.gke.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  # Habilitar Workload Identity para acceso seguro a servicios GCP
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }
}

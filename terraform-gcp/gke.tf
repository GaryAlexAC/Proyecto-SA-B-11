resource "google_container_cluster" "primary" {
  name     = "bank-usac-cluster"
  location = var.zone

  # Eliminar el pool por defecto para crear uno administrado explícitamente
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.self_link
  subnetwork = google_compute_subnetwork.gke_subnet.self_link

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods-range"
    services_secondary_range_name = "gke-services-range"
  }

  # Deshabilitar servicios innecesarios para ahorrar memoria y créditos
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  deletion_protection = false
}

resource "google_container_node_pool" "primary_nodes" {
  name       = "bank-usac-nodes"
  location   = var.zone
  cluster    = google_container_cluster.primary.name
  node_count = 2

  node_config {
    machine_type = "e2-standard-2" # 2 vCPUs, 8 GB RAM cada nodo (Total: 4 vCPUs, 16 GB RAM)
    disk_size_gb = 40
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    metadata = {
      disable-legacy-endpoints = "true"
    }

    labels = {
      project = "bank-usac"
    }
  }
}

output "db_vm_internal_ip" {
  description = "IP interna de la VM de PostgreSQL (usar en DATABASE_URL de los microservicios)"
  value       = google_compute_instance.database.network_interface[0].network_ip
}

output "db_vm_external_ip" {
  description = "IP externa de la VM (solo para administración inicial via SSH)"
  value       = google_compute_instance.database.network_interface[0].access_config[0].nat_ip
}

output "gke_cluster_name" {
  description = "Nombre del cluster GKE"
  value       = google_container_cluster.main.name
}

output "gke_cluster_endpoint" {
  description = "Endpoint del cluster GKE"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "registry_url" {
  description = "URL base del Artifact Registry para tagging de imágenes"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/bank-usac"
}

output "connect_to_cluster_cmd" {
  description = "Comando para conectar kubectl al cluster"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --region ${var.region} --project ${var.project_id}"
}

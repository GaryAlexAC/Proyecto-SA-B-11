output "gke_cluster_name" {
  description = "Nombre del clúster de Kubernetes en GCP"
  value       = google_container_cluster.primary.name
}

output "gke_zone" {
  description = "Zona del clúster GKE"
  value       = google_container_cluster.primary.location
}

output "gke_endpoint" {
  description = "Endpoint del clúster GKE"
  value       = google_container_cluster.primary.endpoint
}

output "db_public_ip" {
  description = "IP Pública de la base de datos PostgreSQL (para túnel SSH / DBeaver)"
  value       = google_compute_address.db_ip.address
}

output "db_private_ip" {
  description = "IP Privada de la base de datos (para los pods de Kubernetes en la VPC)"
  value       = google_compute_instance.database.network_interface[0].network_ip
}

output "artifact_registry_repo" {
  description = "URL base del repositorio Docker en Artifact Registry"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.bank_repo.repository_id}"
}

output "kubectl_connect_command" {
  description = "Comando para conectar kubectl al clúster de GKE"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --zone ${google_container_cluster.primary.location} --project ${var.project_id}"
}

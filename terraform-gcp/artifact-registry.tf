resource "google_artifact_registry_repository" "bank_repo" {
  location      = var.region
  repository_id = "bank-usac"
  description   = "Repositorio Docker para imágenes de Bank USAC"
  format        = "DOCKER"
}

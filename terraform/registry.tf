# ============================================================
# Artifact Registry — Docker images
# ============================================================
resource "google_artifact_registry_repository" "bank_usac" {
  location      = var.region
  repository_id = "bank-usac"
  description   = "Docker images for Bank USAC microservices"
  format        = "DOCKER"
}

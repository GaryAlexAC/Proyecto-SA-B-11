variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "project-de5dd415-1a0b-4df8-8a8"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "us-central1-a"
}

variable "credentials_file" {
  description = "Path to the GCP service account JSON key file (optional, defaults to Application Default Credentials)"
  type        = string
  default     = ""
}

variable "db_password" {
  description = "Password for PostgreSQL superuser (bankadmin)"
  type        = string
  sensitive   = true
}

variable "db_admin_user" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "bankadmin"
}

variable "gke_machine_type" {
  description = "Machine type for GKE node pool"
  type        = string
  default     = "e2-standard-4" # 4 vCPUs, 16 GB RAM (Ideal para todos los microservicios + observabilidad)
}

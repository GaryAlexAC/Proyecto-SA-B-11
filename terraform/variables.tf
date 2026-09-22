variable "project_id" {
  description = "GCP Project ID"
  type        = string
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

variable "db_password" {
  description = "Password for PostgreSQL superuser"
  type        = string
  sensitive   = true
}

variable "db_admin_user" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "admin"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

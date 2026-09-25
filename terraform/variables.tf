variable "resource_group_name" {
  description = "Azure Resource Group"
  type        = string
  default     = "BankUsacRG"
}

variable "location" {
  description = "Azure Region"
  type        = string
  default     = "East US"
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

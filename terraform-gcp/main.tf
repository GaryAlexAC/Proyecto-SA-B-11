terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.20"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  credentials = var.credentials_file != "" && fileexists(var.credentials_file) ? file(var.credentials_file) : null
  project     = var.project_id
  region      = var.region
  zone        = var.zone
}

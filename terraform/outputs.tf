output "db_vm_internal_ip" {
  description = "IP interna de la VM de PostgreSQL"
  value       = azurerm_network_interface.db_nic.private_ip_address
}

output "db_vm_external_ip" {
  description = "IP externa de la VM"
  value       = azurerm_public_ip.db_pip.ip_address
}

output "aks_cluster_name" {
  description = "Nombre del cluster AKS"
  value       = azurerm_kubernetes_cluster.main.name
}

output "registry_url" {
  description = "URL del Azure Container Registry"
  value       = azurerm_container_registry.bank_usac.login_server
}

output "registry_username" {
  description = "Usuario admin de ACR"
  value       = azurerm_container_registry.bank_usac.admin_username
  sensitive   = true
}

output "registry_password" {
  description = "Contraseña admin de ACR"
  value       = azurerm_container_registry.bank_usac.admin_password
  sensitive   = true
}

output "connect_to_cluster_cmd" {
  description = "Comando para conectar kubectl al cluster"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.rg.name} --name ${azurerm_kubernetes_cluster.main.name}"
}

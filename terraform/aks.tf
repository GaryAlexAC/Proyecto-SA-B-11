resource "azurerm_kubernetes_cluster" "main" {
  name                = "bank-usac-cluster"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "bankusac"
  oidc_issuer_enabled = true
  default_node_pool {
    name       = "default"
    node_count = 1
    vm_size    = "Standard_D2as_v7"
    vnet_subnet_id = azurerm_subnet.aks.id
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    dns_service_ip = "10.0.3.10"
    service_cidr   = "10.0.3.0/24"
  }
}

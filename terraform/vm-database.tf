resource "azurerm_public_ip" "db_pip" {
  name                = "bank-usac-db-pip"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_interface" "db_nic" {
  name                = "bank-usac-db-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.db.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.db_pip.id
  }
}

resource "azurerm_linux_virtual_machine" "database" {
  name                = "bank-usac-db"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_D2as_v7"
  admin_username      = var.db_admin_user
  admin_password      = var.db_password
  disable_password_authentication = false

  network_interface_ids = [
    azurerm_network_interface.db_nic.id,
  ]

  os_disk {
    name                 = "bank-usac-db-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/scripts/setup-postgres.sh", {
    DB_PASSWORD   = var.db_password
    DB_ADMIN_USER = var.db_admin_user
  }))
}

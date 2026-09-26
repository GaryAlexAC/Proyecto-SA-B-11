#!/bin/bash
# =============================================================
# Script de inicialización de PostgreSQL para la VM de Bank USAC
# Se ejecuta automáticamente al crear la VM con Terraform
# =============================================================

set -e
exec > /var/log/startup-script.log 2>&1

echo "=== Iniciando configuración de PostgreSQL ==="

# Actualizar sistema
apt-get update -y
apt-get upgrade -y

# Instalar PostgreSQL 15
apt-get install -y postgresql postgresql-contrib

# Iniciar y habilitar el servicio
systemctl enable postgresql
systemctl start postgresql

# Configurar pg_hba.conf para aceptar conexiones desde la red virtual de Azure
PG_HBA="/etc/postgresql/14/main/pg_hba.conf"
# Ubuntu 22.04 puede instalar PG 14
if [ -f "/etc/postgresql/15/main/pg_hba.conf" ]; then
  PG_HBA="/etc/postgresql/15/main/pg_hba.conf"
fi

# Permitir conexiones desde el rango privado que contiene la VNet
echo "host    all             all             10.0.0.0/8              md5" >> $PG_HBA

# Configurar postgresql.conf para escuchar en todas las interfaces
PG_CONF=$(dirname $PG_HBA)/postgresql.conf
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" $PG_CONF

# Crear usuario admin y las 5 bases de datos
sudo -u postgres psql <<EOF
-- Crear usuario administrador
CREATE USER ${DB_ADMIN_USER} WITH SUPERUSER ENCRYPTED PASSWORD '${DB_PASSWORD}';

-- Crear las 5 bases de datos del sistema Bank USAC
CREATE DATABASE db_customer  OWNER ${DB_ADMIN_USER};
CREATE DATABASE db_account   OWNER ${DB_ADMIN_USER};
CREATE DATABASE db_transaction OWNER ${DB_ADMIN_USER};
CREATE DATABASE db_payment   OWNER ${DB_ADMIN_USER};
CREATE DATABASE db_notification OWNER ${DB_ADMIN_USER};

-- Dar permisos completos
GRANT ALL PRIVILEGES ON DATABASE db_customer    TO ${DB_ADMIN_USER};
GRANT ALL PRIVILEGES ON DATABASE db_account     TO ${DB_ADMIN_USER};
GRANT ALL PRIVILEGES ON DATABASE db_transaction TO ${DB_ADMIN_USER};
GRANT ALL PRIVILEGES ON DATABASE db_payment     TO ${DB_ADMIN_USER};
GRANT ALL PRIVILEGES ON DATABASE db_notification TO ${DB_ADMIN_USER};
EOF

# Reiniciar PostgreSQL para aplicar cambios
systemctl restart postgresql

echo "=== PostgreSQL configurado exitosamente ==="
echo "=== Bases de datos creadas: db_customer, db_account, db_transaction, db_payment, db_notification ==="

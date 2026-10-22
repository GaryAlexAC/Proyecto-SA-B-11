resource "google_compute_address" "db_ip" {
  name   = "bank-usac-db-ip"
  region = var.region
}

resource "google_compute_instance" "database" {
  name         = "bank-usac-db"
  machine_type = "e2-medium"
  zone         = var.zone

  tags = ["database-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.db_subnet.self_link
    access_config {
      nat_ip = google_compute_address.db_ip.address
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -e
    exec > /var/log/startup-script.log 2>&1
    echo "=== Iniciando configuración de PostgreSQL en GCP ==="

    apt-get update -y
    apt-get install -y postgresql postgresql-contrib

    systemctl enable postgresql
    systemctl start postgresql

    PG_CONF=$(find /etc/postgresql/ -name postgresql.conf | head -n 1)
    PG_HBA=$(find /etc/postgresql/ -name pg_hba.conf | head -n 1)

    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    echo "host    all             all             0.0.0.0/0              md5" >> "$PG_HBA"

    sudo -u postgres psql <<PSQL
    CREATE USER ${var.db_admin_user} WITH SUPERUSER ENCRYPTED PASSWORD '${var.db_password}';

    CREATE DATABASE db_customer     OWNER ${var.db_admin_user};
    CREATE DATABASE db_account      OWNER ${var.db_admin_user};
    CREATE DATABASE db_transaction  OWNER ${var.db_admin_user};
    CREATE DATABASE db_payment      OWNER ${var.db_admin_user};
    CREATE DATABASE db_notification OWNER ${var.db_admin_user};

    GRANT ALL PRIVILEGES ON DATABASE db_customer     TO ${var.db_admin_user};
    GRANT ALL PRIVILEGES ON DATABASE db_account      TO ${var.db_admin_user};
    GRANT ALL PRIVILEGES ON DATABASE db_transaction  TO ${var.db_admin_user};
    GRANT ALL PRIVILEGES ON DATABASE db_payment      TO ${var.db_admin_user};
    GRANT ALL PRIVILEGES ON DATABASE db_notification TO ${var.db_admin_user};
PSQL

    systemctl restart postgresql
    echo "=== PostgreSQL configurado exitosamente en GCP ==="
  EOF
}

# Infraestructura como código

La infraestructura activa se aprovisiona en Google Cloud Platform mediante
Terraform y se ejecuta en la región `us-central1`, zona `us-central1-a`.

## Recursos administrados

Terraform define los siguientes recursos:

- VPC y subredes privadas.
- Reglas de firewall para GKE y PostgreSQL.
- Clúster Google Kubernetes Engine `bank-usac-cluster`.
- Artifact Registry para imágenes Docker.
- VM Compute Engine `bank-usac-db` para PostgreSQL.
- Outputs de red, clúster, registro y base de datos.

La configuración principal se encuentra en `terraform-gcp/`:

| Archivo | Responsabilidad |
| --- | --- |
| `main.tf` | Proveedor y configuración base de GCP |
| `vpc.tf` | VPC y subredes |
| `gke.tf` | Clúster y nodos GKE |
| `vm-database.tf` | VM de PostgreSQL |
| `artifact-registry.tf` | Registro de imágenes |
| `firewall.tf` | Reglas de red |
| `outputs.tf` | Valores útiles después del provisionamiento |

## Flujo de ejecución

Desde `terraform-gcp/`:

```bash
terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

El archivo `terraform.tfvars` real no debe publicarse. Se debe utilizar
`terraform.tfvars.example` como referencia y proporcionar los valores sensibles
mediante el mecanismo seguro definido por el equipo.

## Separación de responsabilidades

Terraform crea la infraestructura base. Helm despliega las cargas de trabajo de
los namespaces `dev` y `prod`. GitHub Actions ejecuta el flujo de integración y
entrega continua; no se debe modificar manualmente un Deployment de producción.

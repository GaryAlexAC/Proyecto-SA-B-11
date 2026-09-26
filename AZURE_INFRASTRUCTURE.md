# Documentación de Infraestructura Azure - Fase 2

Este documento contiene todos los detalles de la infraestructura aprovisionada en Azure para el proyecto Bank USAC, adaptada a las restricciones de la cuenta de estudiantes (Azure Free Tier).

## Detalles Generales
- **Región de Despliegue:** `East US 2` (Elegida estratégicamente para evitar topes de cuota).
- **Grupo de Recursos:** `BankUsacRG_Fase2`

## 1. Clúster de Kubernetes (AKS)
- **Nombre del Clúster:** `bank-usac-cluster`
- **Nodos:** 1 Nodo (Tamaño: `Standard_D2as_v7` - 2 vCPUs)
- **Comando de conexión local:** 
  ```bash
  az aks get-credentials --resource-group BankUsacRG_Fase2 --name bank-usac-cluster
  ```

## 2. Base de Datos (PostgreSQL en VM)
- **Máquina Virtual:** `bank-usac-db` (Tamaño: `Standard_D2as_v7` - 2 vCPUs, Ubuntu 22.04 LTS Gen2)
- **IP Externa (Para conectarse con DBeaver/pgAdmin):** `20.94.62.20`
- **IP Interna (Para uso interno de los microservicios):** `10.0.2.4`
- **Usuario Admin:** `bankadmin`
- **Contraseña:** `SA_Grupo11`

## 3. Azure Container Registry (ACR)
- **URL del Registry:** `bankusacregistryahq6a0.azurecr.io`
- **Para obtener usuario y contraseña:** Entrar a la carpeta `terraform` en la consola y ejecutar:
  - `terraform output -raw registry_username`
  - `terraform output -raw registry_password`

## 4. Configuración de GitHub Secrets (CI/CD)
Para que los pipelines de GitHub Actions funcionen correctamente, los siguientes *Repository Secrets* deben estar configurados en el repositorio:

| Secreto | Valor |
|---|---|
| `REGISTRY_URL` | `bankusacregistryahq6a0.azurecr.io` |
| `AKS_CLUSTER_NAME` | `bank-usac-cluster` |
| `AZURE_RG` | `BankUsacRG_Fase2` |
| `REGISTRY_USERNAME` | (Valor obtenido del output de terraform) |
| `REGISTRY_PASSWORD` | (Valor obtenido del output de terraform) |
| `AZURE_CREDENTIALS` | (JSON de autenticación del Service Principal) |

---
*Nota Arquitectónica: Toda la infraestructura fue ajustada milimétricamente para consumir exactamente **4 vCPUs** en total (2 para AKS, 2 para la VM), respetando el límite máximo estricto de la cuota de la suscripción de Azure for Students.*

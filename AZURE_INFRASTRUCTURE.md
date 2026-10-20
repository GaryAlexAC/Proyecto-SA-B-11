# Documentación de Infraestructura Azure - Fase 2

Este documento contiene todos los detalles de la infraestructura aprovisionada en Azure para el proyecto Bank USAC, adaptada a las restricciones de la cuenta de estudiantes (Azure Free Tier).

## Detalles Generales
- **Región de Despliegue:** `East US 2` (Elegida estratégicamente para evitar topes de cuota).
- **Grupo de Recursos:** `BankUsacRG_Fase2`

## Modelo de Cómputo

No se administran servidores físicos. Azure proporciona el hardware del centro
de datos y el proyecto utiliza dos máquinas virtuales:

| Máquina virtual | Tamaño | Uso |
|---|---|---|
| Nodo trabajador de AKS | `Standard_D2as_v7` (2 vCPU) | Ejecuta todos los Pods del frontend, API Gateway, microservicios y RabbitMQ |
| `bank-usac-db` | `Standard_D2as_v7` (2 vCPU) | Ejecuta Ubuntu Server 22.04 LTS y PostgreSQL |

El plano de control de AKS, Azure Load Balancer y Azure Container Registry son
servicios administrados y no representan máquinas adicionales gestionadas por
el equipo.

## 1. Clúster de Kubernetes (AKS)
- **Nombre del Clúster:** `bank-usac-cluster`
- **Nodos:** 1 Nodo (Tamaño: `Standard_D2as_v7` - 2 vCPUs)
- **Comando de conexión local:** 
  ```bash
  az aks get-credentials --resource-group BankUsacRG_Fase2 --name bank-usac-cluster
  ```

## 2. Base de Datos (PostgreSQL en VM)
- **Máquina Virtual:** `bank-usac-db` (Tamaño: `Standard_D2as_v7` - 2 vCPUs, Ubuntu 22.04 LTS Gen2)
- **IP Externa:** Consultar con `terraform output -raw db_vm_external_ip`.
- **IP Interna:** Consultar con `terraform output -raw db_vm_internal_ip`.
- **Usuario Admin:** `bankadmin`
- **Contraseña:** Valor sensible proporcionado mediante `db_password`; no debe almacenarse en documentación ni en el repositorio.

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
*Nota arquitectónica: la configuración base solicita 4 vCPU en total: 2 vCPU para el nodo trabajador de AKS y 2 vCPU para la VM de PostgreSQL. Los servicios administrados de Azure no se contabilizan como máquinas virtuales controladas por el equipo.*

---

## 5. Manual Rápido: Comandos Básicos (Azure Cloud Shell)

Si en algún momento necesitas entrar a la consola de Azure (Cloud Shell) para revisar qué está pasando, la consola usa comandos estándar de Linux (`bash`) y `kubectl`.

**Para moverte y ver archivos:**
- `ls` - Muestra los archivos y carpetas en tu ubicación actual.
- `cd nombre_carpeta` - Entra a una carpeta.
- `cd ..` - Sube una carpeta atrás.
- `pwd` - Te dice en qué ruta exacta estás.
- `cat nombre_archivo` - Lee el contenido de un archivo en la consola.

**Para conectar Kubernetes (solo la primera vez que abres la consola):**
```bash
az aks get-credentials --resource-group BankUsacRG_Fase2 --name bank-usac-cluster
```

**Para diagnosticar Kubernetes (Microservicios):**
- `kubectl get pods -n dev` - Lista todos tus microservicios y te dice si están `Running` o fallando.
- `kubectl logs -n dev -l app=nombre-del-servicio` - Te muestra la consola/terminal interna del servicio (muy útil para ver errores de código, bases de datos o RabbitMQ).
- `kubectl describe pod -n dev -l app=nombre-del-servicio` - Te muestra el estado detallado (útil si el pod se quedó en `Pending` o `CrashLoopBackOff`).
- `kubectl rollout restart deployment/nombre-del-servicio -n dev` - Apaga y vuelve a prender un microservicio (como reiniciar la PC).

## 6. Flujo de Trabajo (Entornos) y Buenas Prácticas

El proyecto tiene **dos ambientes aislados** en el mismo clúster de Kubernetes:

| Namespace | Descripción | URL de acceso |
|---|---|---|
| `dev` | Desarrollo y pruebas internas | Acceso por `port-forward` (sin IP pública) |
| `prod` | Producción — usuarios reales | `http://130.213.247.56` |

1. **Desarrollo:** Los programadores trabajan en ramas como `feature/X` o `fix/Y`.
2. **Integración:** Al hacer merge a `develop`, el pipeline `ci-cd-develop.yml` compila y despliega automáticamente en el **Namespace `dev`**.
3. **Release:** Para publicar una versión oficial, se crea un Tag de Git (`v1.0.1`, etc). El pipeline `release.yml` compila y publica todas las imágenes en el ACR con ese número de versión.
4. **Producción:** Al hacer merge de `develop` a `main`, el pipeline `cd-production.yml` despliega las imágenes versionadas en el **Namespace `prod`**.

> **Nota importante sobre recursos:** El clúster tiene 2 vCPUs disponibles. Si se necesita que `dev` y `prod` corran a la vez, escalar a 0 los servicios de `dev` que no se estén usando activamente:
> ```bash
> kubectl scale deployment/transaction-service deployment/payment-service deployment/notification-service --replicas=0 -n dev
> # Para reactivarlos:
> kubectl scale deployment/transaction-service deployment/payment-service deployment/notification-service --replicas=1 -n dev
> ```

## 7. Acceso a los Entornos

### Producción (para usuarios finales)
```
URL: http://130.213.247.56
Admin: admin / ChangeMe123
```

### Dev (para el equipo de desarrollo)
```bash
# Acceso temporal vía port-forward:
kubectl port-forward svc/frontend 8080:80 -n dev
# Luego abrir: http://localhost:8080
```

### Comandos útiles para diagnosticar Kubernetes

**Reemplazar `dev` por `prod` según el namespace que necesites:**
```bash
# Ver pods
kubectl get pods -n dev
kubectl get pods -n prod

# Ver logs de un servicio
kubectl logs -n dev -l app=customer-service --tail=50

# Reiniciar un servicio
kubectl rollout restart deployment/customer-service -n dev

# Ver estado detallado de un pod
kubectl describe pod -n dev -l app=customer-service
```

## 8. Secretos en Kubernetes

Algunos servicios requieren secretos que NO están en los YAML (por seguridad). Si recrean los namespaces, deben volver a crear:

```bash
# Credenciales de correo (notification-service) — aplicar en AMBOS namespaces
kubectl create secret generic email-credentials \
  --from-literal=email-user="gabrielchinchilla.sa.2024@gmail.com" \
  --from-literal=email-app-pass="fgimglcbnnzwdefq" \
  -n dev

kubectl create secret generic email-credentials \
  --from-literal=email-user="gabrielchinchilla.sa.2024@gmail.com" \
  --from-literal=email-app-pass="fgimglcbnnzwdefq" \
  -n prod
```

## 9. Conexión a la Base de Datos (PostgreSQL)

```
Host:     20.94.62.20
Puerto:   5432
Usuario:  bankadmin
Password: SA_Grupo11

Bases de datos:
  - db_customer   (customer-service)
  - db_account    (account-service)
  - db_transaction (transaction-service)
  - db_payment    (payment-service)
  - db_notification (notification-service)

String de conexión (ejemplo customer-service - dev):
postgresql://bankadmin:SA_Grupo11@20.94.62.20:5432/db_customer?schema=public

String de conexión (ejemplo customer-service - prod):
postgresql://bankadmin:SA_Grupo11@20.94.62.20:5432/db_customer?schema=prod
```


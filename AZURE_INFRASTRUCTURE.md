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

Actualmente, el pipeline que arreglamos hoy se despliega en el **ambiente de desarrollo (`dev`)**.
Como Arquitecto de Software, este es el flujo correcto que tu equipo debe seguir:

1. **Desarrollo:** Los programadores trabajan en ramas como `feature/X` o `fix/Y`.
2. **Integración (El pipeline de hoy):** Cuando hacen *Pull Request* y mezclan su código hacia `develop`, el pipeline `ci-cd-develop.yml` entra en acción, compila, y despliega automáticamente en el **Namespace `dev`** de Kubernetes. Aquí es donde los QA o ustedes mismos prueban que todo funcione.
3. **Paso a Producción (Release):** Cuando la rama `develop` está estable y quieren lanzar una versión final al público, el líder técnico crea un **Release/Tag** (ej. `v1.0.0`) o hace un merge a `main`. 
   - El proyecto tiene archivos preparados para esto (`release.yml` y `cd-production.yml`). 
   - Estos pipelines toman la versión estable y la despliegan en el **Namespace `prod`**, un entorno aislado para los usuarios reales, garantizando que el desarrollo del día a día no rompa la aplicación principal.

## 7. ¿Cómo probarlo? (Ver la app funcionando)

El microservicio `frontend` está configurado como un `LoadBalancer`, lo que significa que Azure le asigna una **IP Pública de internet**. Para encontrarla y entrar a la aplicación, abre tu Azure Cloud Shell, asegúrate de haber corrido el comando de `az aks get-credentials` (arriba), y luego ejecuta:

```bash
kubectl get svc frontend -n dev
```

En la tabla que aparecerá, busca la columna **`EXTERNAL-IP`**. Copia el valor
asignado actualmente y ábrelo en el navegador mediante `http://<EXTERNAL-IP>`.
La dirección puede cambiar si se recrea el Service, por lo que no debe fijarse en
la documentación ni en el frontend.

**Salida en consola:**
```bash
NAME       TYPE           CLUSTER-IP   EXTERNAL-IP     PORT(S)        AGE
frontend   LoadBalancer   <cluster-ip> <external-ip>   80:<node-port>/TCP
```

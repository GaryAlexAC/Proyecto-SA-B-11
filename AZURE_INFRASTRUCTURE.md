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

En la tabla que aparecerá, busca la columna **`EXTERNAL-IP`**. 
Copia esa IP (en nuestro caso es **`9.169.131.155`**), pégala en tu navegador web de la siguiente forma: `http://9.169.131.155` y... ¡Deberías ver la interfaz de tu banco cargando desde Azure!

**Salida en consola:**
```bash
NAME       TYPE           CLUSTER-IP   EXTERNAL-IP     PORT(S)        AGE
frontend   LoadBalancer   10.0.3.30    9.169.131.155   80:30320/TCP   55m
```

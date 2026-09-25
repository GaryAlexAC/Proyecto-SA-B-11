# Despliegue implementado

![Desplieguiue](../img/Despliegue.png)

## Frontend en Cloud Run (dev)

El frontend React se despliega como el servicio público `bank-usac-frontend-dev` en Cloud Run. La imagen se construye desde `frontend/Dockerfile`, sirve los archivos estáticos con Nginx en el puerto `8080` y se publica en Artifact Registry con el tag inmutable `dev-<commit-sha>`.

El API Gateway permanece fuera del alcance del despliegue del frontend. Antes de ejecutar el workflow, debe existir una URL pública HTTPS para el Gateway y configurarse como la variable de repositorio `API_GATEWAY_URL_DEV`. Vite incorpora ese valor durante el build como `VITE_API_GATEWAY_URL`.

El job `deploy-frontend` de `.github/workflows/ci-cd-develop.yml` espera el build y los tests globales. Se ejecuta automáticamente después de cada merge a `develop`; no requiere despliegue manual.

En un release (`release/<version>` o tag `vX.X.X`), `release.yml` publica la imagen `frontend:<version>`, compilada con `API_GATEWAY_URL_PROD`. Al hacer merge a `main`, `cd-production.yml` despliega esa misma imagen en `bank-usac-frontend-prod` y valida que responda. Esto mantiene separados dev y prod, y evita reconstruir o usar imágenes `latest` en producción.

Terraform habilita la API `run.googleapis.com` mediante `terraform/cloud-run.tf`. La infraestructura de red, registry, GKE y VM sigue siendo compartida con el resto del sistema.

Los workflows requieren estos valores en GitHub:

- Secret `GCP_SA_KEY`: JSON de la cuenta de servicio de GCP.
- Secret `REGISTRY_URL`: URL base del Artifact Registry, por ejemplo `us-central1-docker.pkg.dev/PROJECT_ID/bank-usac`.
- Variable `GCP_REGION`, o el secret existente `GKE_REGION`: región de Cloud Run y Artifact Registry.
- Variable `API_GATEWAY_URL_DEV`: URL pública HTTPS del API Gateway, sin rutas adicionales.
- Variable `API_GATEWAY_URL_PROD`: URL pública HTTPS del API Gateway de producción, sin rutas adicionales.

La cuenta de servicio necesita, como mínimo, los roles Artifact Registry Writer, Cloud Run Admin y Service Account User. También debe estar habilitada la API `run.googleapis.com` en el proyecto GCP.

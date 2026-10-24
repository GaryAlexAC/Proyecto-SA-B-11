# CI/CD y estrategia de ramas

El pipeline implementa las etapas obligatorias del enunciado: compilación,
pruebas y validación. Los despliegues se ejecutan automáticamente y se separan
por entorno.

## Flujo de ramas

| Rama o referencia | Flujo | Resultado |
| --- | --- | --- |
| `feature/*` | Build, Test y Validate | Verificación de la funcionalidad antes del merge |
| `develop` | Build, Test, construcción y publicación de imágenes, despliegue Helm | Entorno `dev` en GKE |
| `release/*` o `vX.Y.Z` | Generación de versión y publicación de imágenes | Imágenes candidatas para producción |
| `main` | Despliegue Helm con la última versión publicada | Rolling update en `prod` |

## Workflows

| Workflow | Archivo | Responsabilidad |
| --- | --- | --- |
| CI Feature | `.github/workflows/ci-feature.yml` | Build, Test, lint y sanity check de Dockerfiles |
| CI/CD Develop | `.github/workflows/ci-cd-develop.yml` | Build, Test, publicación en Artifact Registry y despliegue en `dev` |
| Release | `.github/workflows/release.yml` | Generación de versión y publicación de imágenes versionadas |
| CD Producción | `.github/workflows/cd-production.yml` | Despliegue de la versión publicada en `prod` |

## Validaciones

El pipeline detiene el flujo si falla una etapa anterior. La compilación prepara
la librería de observabilidad y los clientes Prisma; después construye todos los
servicios. Las pruebas se ejecutan antes de publicar imágenes. El despliegue
verifica el rollout de RabbitMQ, API Gateway, microservicios, frontend y el stack
de observabilidad.

## Despliegue

GitHub Actions se autentica contra Google Cloud mediante Workload Identity
Federation. Las imágenes se publican en Artifact Registry y Helm actualiza los
Deployments del namespace correspondiente. Producción solo se despliega después
de un cambio en `main` y utiliza una versión proveniente de un release.

No se debe ejecutar un despliegue manual en producción.

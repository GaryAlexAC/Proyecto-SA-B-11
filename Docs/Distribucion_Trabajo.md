# Distribución Oficial del Trabajo - Bank USAC (Proyecto 2)

Este documento detalla la distribución de tareas para la **Fase 2 (Evolución a Cloud)**. El objetivo es equilibrar la carga integrando CI/CD, infraestructura en la nube y nuevas reglas de negocio.

## 1. Gabriel (Infraestructura, DevOps & Notification) - ✅ Completado
- **Infraestructura Cloud (Terraform):** Creación de Azure Virtual Network, Network Security Group, Azure Container Registry, clúster AKS y aprovisionamiento de una VM para PostgreSQL con script automático.
- **Pipelines CI/CD (GitHub Actions):** Integración continua en `feature/*`, despliegue automatizado a `develop`, versionamiento en `release/*` y rolling update en producción (`main`).
- **Autoescalado:** Configuración de HPA al 80% de CPU para todos los microservicios en Kubernetes.
- **Notification Service Extendido:**
  - Envío real de correos electrónicos implementado con **Nodemailer**.
  - Clasificación de eventos en Prisma mediante el campo `severity` (`INFO`, `WARNING`, `ERROR`).
  - Lógica para capturar y notificar los nuevos eventos (`PaymentTimeout`).

---

## 2. Gary (Frontend, KYC & Documentación C4) - ✅ Completado
**Responsabilidad:** Extensiones gráficas, servicio al cliente y documentación visual.

**Tareas Técnicas:**
1. **Frontend (React + TS):** 
   - Nueva interfaz de administración para ver y cambiar el estado KYC de los clientes.
   - Filtros de estado y fecha en el historial de transacciones.
   - **Integración de despliegue:** El frontend se empaqueta con Nginx y se ejecuta como contenedor dentro de Kubernetes (GKE / AKS).
2. **Customer Service (NestJS):**
   - Nuevo modelo/campo `kycStatus` (`PENDING | VERIFIED | REJECTED`).
   - Emitir evento `KYCStatusUpdated` (gravedad INFO/WARNING dependiendo si fue exitoso o rechazado).
3. **Documentación Técnica (Fase F):**
   - Diagramas C4 (Contexto, Contenedores, Componentes) y documentación de arquitectura.
   - Documentar la arquitectura de despliegue cloud en `deployment.md`.

---

## 3. Andrés (Núcleo Financiero Core) - ✅ Completado
**Responsabilidad:** Implementación de nuevas reglas bancarias complejas, saldos mínimos y fallos de timeout en la Saga.

**Tareas Técnicas:**
1. **Account Service (NestJS):**
   - Configurar tipo de cuenta (Ahorro/Corriente) y saldo mínimo.
   - Lógica para bloquear la reserva de fondos si la transferencia viola el saldo mínimo (emitir `MinimumBalanceViolated`).
   - Configurar "transaction fee" (comisión de transferencia) descontando saldo adicional.
2. **Transaction Service (NestJS):**
   - Endpoints para historial filtrado (`?accountId=X&status=Y&from=Z`).
   - Gestión de estados de transición de transacciones (`PENDING` -> `APPROVED/FAILED`).
   - Agregar el paso **"Verificación de KYC"** al inicio de la Saga (cancelar al instante si está REJECTED).
3. **Payment Service (NestJS):**
   - Simular intermitencia de servicios externos (Timeouts):
     - Configurar probabilidades de éxito (70%), rechazo (20%), y **timeout** (10%).
     - Emitir evento de `PaymentTimeout` para probar la severidad ERROR en la notificación.

---

## 4. Estado de Cumplimiento Global
Todas las responsabilidades asignadas a los tres integrantes han sido desarrolladas, integradas mediante Pull Requests, validadas con el Pipeline CI/CD y desplegadas exitosamente en el clúster de Kubernetes en Google Cloud Platform (GKE).

# Distribución Oficial del Trabajo - Bank USAC

Debido a la magnitud técnica del proyecto, el trabajo se ha distribuido de la siguiente manera para balancear la carga equitativamente (considerando la documentación, la complejidad del frontend y el núcleo transaccional).

## 1. Gabriel (Arquitectura, Gateway & Auditoría) - ✅ Completado
- **Arquitectura Base:** Configuración del monorepo (Turborepo), scripts base.
- **Infraestructura (Docker):** Orquestación de las 5 bases de datos de PostgreSQL y RabbitMQ.
- **API Gateway:** Configuración como enrutador inteligente. Ya expone los controladores REST (`/api/customers`, `/api/accounts`, `/api/transactions`, `/api/payments`) y envía los mensajes mediante `ClientProxy.send()` por RabbitMQ con su respectivo `correlationId`.
- **Notification & Audit Service:** Lógica core terminada (Prisma + RabbitMQ Consumers), ya captura los eventos y simula envío de correos.

---

## 2. Gary (Frontend & Customer) - ⏳ Pendiente
**Responsabilidad:** Desarrollo de la interfaz gráfica y la gestión de usuarios/auth.

**Tareas técnicas:**
1. **Frontend (React + TS):** 
   - Desarrollar la aplicación web. El diseño debe lucir **Premium** (requisito crítico).
   - El frontend se comunicará *únicamente* a través de los endpoints del API Gateway (puerto 3000 por defecto).
2. **Customer Service (NestJS):**
   - Para iniciarlo, corre en la raíz: `npx nest generate app customer-service`
   - Configurar Prisma y conectarlo a la base de datos `db_customer` (puerto 5433).
   - Funcionalidades: Autenticación (JWT), registro de clientes, validación de identidad.
   - Debe escuchar comandos desde el API Gateway y emitir eventos como `CustomerRegistered` o `ActivationEmailRequested` al RabbitMQ.

---

## 3. Andrés (Núcleo Financiero Core) - ⏳ Pendiente
**Responsabilidad:** Implementación de la lógica bancaria y las transferencias distribuidas.

**Tareas técnicas:**
1. **Account Service (NestJS):**
   - Para iniciarlo: `npx nest generate app account-service`
   - Base de datos: `db_account` (puerto 5434).
   - Funcionalidades: Gestión de cuentas, bloqueos, consulta de saldo y, lo más importante, el manejo seguro de **Reserva/Liberación de fondos** (vital para evitar inconsistencias de saldos).
2. **Transaction Service (NestJS):**
   - Para iniciarlo: `npx nest generate app transaction-service`
   - Base de datos: `db_transaction` (puerto 5435).
   - Funcionalidades: Coordinador de la **Saga Coreográfica** de transferencias bancarias. 
3. **Payment Service (NestJS):**
   - Para iniciarlo: `npx nest generate app payment-service`
   - Base de datos: `db_payment` (puerto 5436).
   - Funcionalidades: Control de pagos internos (es un CRUD pequeño con estados).

> [!NOTE]
> **Para Andrés y Gary:** Toda la infraestructura ya está servida. Solo necesitan encender su Docker (`docker-compose up -d`), generar su microservicio de Nest, instalar sus librerías de Prisma/RabbitMQ dentro de su respectiva carpeta, y enfocarse 100% en la lógica de negocio usando la documentación oficial.

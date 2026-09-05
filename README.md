# Bank USAC - Proyecto Software Avanzado (Grupo B-13) 🏦🎓

Este repositorio contiene la implementación de una arquitectura basada en **Microservicios Coreografiados** para la gestión de un sistema bancario transaccional, utilizando el patrón **Saga** para mantener la consistencia de los datos distribuidos.

## 🏗️ Arquitectura del Sistema

El proyecto está estructurado como un **Monorepo** gestionado por [Turborepo](https://turbo.build/) y contiene los siguientes microservicios construidos con **NestJS**:

- **`api-gateway`**: Expone los endpoints REST hacia los clientes (UI/Postman) y enruta el tráfico hacia RabbitMQ.
- **`account-service`**: Gestiona cuentas, saldo disponible y reservas de fondos.
- **`transaction-service`**: Registra transferencias y reacciona a los eventos de la Saga coreografiada.
- **`payment-service`**: Gestiona compañías, servicios y pagos asociados a transacciones.
- **`notification-service`**: Auditoría y simulaciones de envío de correos sobre transacciones completadas.

### 🔌 Tecnologías Clave

- **Framework**: NestJS (v12)
- **Mensajería Asíncrona**: RabbitMQ (Coreografía de microservicios)
- **Base de Datos**: PostgreSQL + Prisma ORM (Clientes independientes por microservicio)
- **Gestión de Monorepo**: Turborepo

## 🚀 Guía de Inicio Rápido (Local)

### 1. Requisitos Previos
- Node.js (v24+)
- Docker y Docker Compose
- PostgreSQL instalado localmente (o usar un contenedor)

### 2. Levantar el stack completo
```bash
docker compose up --build -d
```

Compose inicia PostgreSQL, RabbitMQ, los cinco microservicios, API Gateway y el frontend. Los servicios aplican sus esquemas de base de datos al iniciar y Customer Service crea el administrador inicial de forma idempotente.

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:3000`
- RabbitMQ Management: `http://localhost:15672`

Las variables configurables y credenciales iniciales están enumeradas en `.env.example`.

### 3. Desarrollo local sin contenedores
```bash
npm install
```

Cada microservicio tiene su propio cliente Prisma. Para generarlos manualmente se debe indicar cada esquema:
```bash
npx prisma generate --schema=apps/customer-service/prisma/schema.prisma
npx prisma generate --schema=apps/account-service/prisma/schema.prisma
npx prisma generate --schema=apps/transaction-service/prisma/schema.prisma
npx prisma generate --schema=apps/payment-service/prisma/schema.prisma
npx prisma generate --schema=apps/notification-service/prisma/schema.prisma
```

### 4. Iniciar servidores en modo desarrollo
Arranca todos los microservicios en paralelo utilizando Turborepo:
```bash
npm run dev
```

## 🧪 Pruebas (E2E Sagas)
Para probar el flujo completo de una transferencia (Patrón Saga), puedes utilizar:
1. El archivo `test-flow.http` (con extensiones como REST Client o Thunder Client).
2. O correr el script automático que verifica la consistencia transaccional:
```bash
node run-test.js
```

---
**Desarrollado para:** Curso de Software Avanzado, USAC. 2do Semestre 2026.

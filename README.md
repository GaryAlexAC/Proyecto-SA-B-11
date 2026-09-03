# Bank USAC - Proyecto Software Avanzado (Grupo B-13) 🏦🎓

Este repositorio contiene la implementación de una arquitectura basada en **Microservicios Coreografiados** para la gestión de un sistema bancario transaccional, utilizando el patrón **Saga** para mantener la consistencia de los datos distribuidos.

## 🏗️ Arquitectura del Sistema

El proyecto está estructurado como un **Monorepo** gestionado por [Turborepo](https://turbo.build/) y contiene los siguientes microservicios construidos con **NestJS**:

- **`api-gateway`**: Expone los endpoints REST hacia los clientes (UI/Postman) y enruta el tráfico hacia RabbitMQ.
- **`account-service`**: Gestiona la creación de cuentas y saldos de clientes.
- **`transaction-service`**: Orquesta y procesa transferencias bancarias usando Sagas.
- **`payment-service`**: (Proyección) Integraciones con servicios de pago.
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

### 2. Levantar la Infraestructura (Base de datos y RabbitMQ)
```bash
docker-compose up -d
```

### 3. Instalación de Dependencias
```bash
npm install
```

### 4. Generar Clientes de Prisma (Aislados)
Debido a la arquitectura desacoplada, cada microservicio tiene su propio cliente Prisma para evitar colisiones:
```bash
npx prisma generate
```
*(Nota: Si usas la base de datos local por primera vez, asegúrate de correr `npx prisma db push` en cada microservicio).*

### 5. Iniciar Servidores en Modo Desarrollo
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
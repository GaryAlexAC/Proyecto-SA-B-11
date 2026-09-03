# Decisiones de arquitectura

## Arquitectura y comunicación

| Decisión implementada | Evidencia |
| --- | --- |
| Cinco microservicios de negocio | Existen Customer, Account, Transaction, Payment y Notification & Audit Service en `apps/`. |
| Mensajería interna con RabbitMQ | Los servicios usan colas RMQ; el API Gateway realiza RPC sobre `customer_queue`, `account_queue`, `transaction_queue` y `payment_queue`. |
| Persistencia aislada por servicio | Cada servicio contiene un esquema Prisma y usa su propia conexión `DATABASE_URL`. |
| Saga parcial de transferencias | Transaction Service envía `ReserveFunds`, `CreditDestination` y, ante rechazo de crédito, `ReleaseFunds`. |
| Monorepo | La raíz usa npm workspaces y Turborepo. |

El API Gateway no coordina la Saga ni publica eventos de dominio. Customer Service también arranca un servidor HTTP, por lo que el punto único de entrada no puede afirmarse como una restricción técnica absoluta.

## Tecnologías implementadas

| Componente | Implementación |
| --- | --- |
| Backend | Node.js, TypeScript y NestJS. |
| Mensajería | RabbitMQ. |
| Persistencia | PostgreSQL y Prisma. |
| Contenedores | Dockerfiles por servicio y `docker-compose.yml` para PostgreSQL y RabbitMQ. |
| Orquestación | Manifiestos de Kubernetes para servicios y RabbitMQ. |
| Repositorio | npm workspaces, Turborepo y Git. |

## Trade-offs tecnológicos

### Node.js y TypeScript

Se eligió Node.js con TypeScript porque la mayoría de operaciones son de entrada/salida: solicitudes HTTP, acceso a bases de datos, mensajería y notificaciones. El tipado facilita compartir modelos y reduce errores durante el desarrollo.

| Ventajas | Trade-offs |
| --- | --- |
| Desarrollo rápido, ecosistema amplio y buen soporte asíncrono. | No es ideal para tareas intensivas de CPU. |
| Tipado estático y menor diversidad tecnológica. | El tipado desaparece en tiempo de ejecución y requiere validación de entradas. |

### NestJS

NestJS se utiliza en los servicios actuales. Aporta estructura modular, inyección de dependencias e integración HTTP y RabbitMQ. Como trade-off, introduce abstracción y más convenciones que un framework mínimo.

### React con TypeScript

React se selecciona por su flexibilidad, ecosistema y soporte de TypeScript. Como trade-off, impone menos estructura arquitectónica que Angular, por lo que el equipo debe definir sus propias convenciones.

### RabbitMQ

RabbitMQ se selecciona para comandos y eventos por su routing flexible, acknowledgements, reintentos y soporte de colas. Es adecuado para workflows asíncronos y tiene menor complejidad operativa que Kafka para el volumen esperado.

| Ventajas | Trade-offs |
| --- | --- |
| Routing flexible, acknowledgements, colas y soporte de reintentos. | Replay histórico limitado frente a Kafka. |
| Menor complejidad operacional que Kafka. | El broker se convierte en infraestructura crítica. |

Kafka ofrece mayor throughput y replay histórico, pero implica más infraestructura y complejidad para las necesidades actuales.

### PostgreSQL y Prisma

PostgreSQL se utiliza para priorizar transacciones ACID, integridad referencial, constraints y consultas relacionales para datos financieros. Prisma aporta acceso tipado a la base de datos.

| Ventajas | Trade-offs |
| --- | --- |
| Consistencia, integridad y relaciones para operaciones financieras. | El escalado horizontal es más complejo. |
| Soporte de SQL, constraints y consultas complejas. | El esquema es más rígido que una base documental. |

## Alcance no implementado

No se incluyen Prometheus, Grafana, logs JSON estructurados, ConfigMap, Secret, NGINX Ingress, DLQ ni reintentos de consumo porque no están implementados.

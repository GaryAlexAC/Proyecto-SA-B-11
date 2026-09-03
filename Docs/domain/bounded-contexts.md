# Contextos delimitados

| Contexto | Servicio propietario | Responsabilidad |
| --- | --- | --- |
| Clientes | Customer Service | Clientes, credenciales, autenticación y activación. |
| Cuentas | Account Service | Cuentas, saldos, reservas, débitos y créditos. |
| Transferencias | Transaction Service | Estado y coordinación de transferencias distribuidas. |
| Pagos | Payment Service | Solicitud, validación y resultado de pagos. |
| Notificaciones y auditoría | Notification & Audit Service | Notificaciones y registro de eventos relevantes. |

Los contextos se integran con comandos y eventos a través de RabbitMQ. Cada contexto mantiene su propia base de datos y no expone acceso directo a ella.

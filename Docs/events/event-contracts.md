# Contratos de eventos implementados

No existe un contrato único validado por todos los servicios. El sobre más completo se implementa al publicar eventos desde Customer Service:

```json
{
  "eventId": "uuid",
  "eventType": "CustomerRegistered",
  "eventVersion": 1,
  "occurredAt": "2026-09-03T00:00:00.000Z",
  "correlationId": "uuid",
  "causationId": null,
  "producer": "customer-service",
  "payload": {}
}
```

Account, Transaction y Payment utilizan mensajes con `eventId`, `eventType`, `correlationId`, `producer` y `payload`, pero no aplican de forma consistente `eventVersion`, `occurredAt` ni `causationId`.

## Garantías implementadas

| Componente | Comportamiento verificable |
| --- | --- |
| Customer Service | Usa outbox transaccional y reintenta la publicación a los 5, 15 y 30 segundos. Si agota los intentos, guarda `failedAt`; no enruta el mensaje a una DLQ. |
| Account Service | Registra eventos procesados para hacer idempotentes `ReserveFunds`, `CreditDestination` y `ReleaseFunds`. |
| Transaction Service | Registra eventos procesados para evitar reprocesar eventos de Account Service. |
| Notification & Audit Service | Evita duplicar el registro de auditoría mediante `eventId`, pero no evita reenviar la notificación simulada. |
| Payment Service | No implementa procesamiento idempotente de eventos. |

No hay configuración de Dead Letter Queue, reintentos de consumo, `ack`/`nack` manual ni validación uniforme del sobre de eventos.

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

Account y Transaction usan `eventId`, `eventType`, `correlationId`, `producer` y `payload`. Los identificadores de las etapas de la Saga son deterministas para que una republicacion conserve el mismo `eventId`.

## Contratos de la Saga de transacciones

`TransactionRequested` y `TransactionProcessing` son publicados por Transaction Service en `account_queue`:

```json
{
  "eventId": "correlationId:transaction-requested",
  "eventType": "TransactionRequested",
  "correlationId": "uuid",
  "producer": "transaction-service",
  "payload": {
    "sourceAccountId": "uuid",
    "targetAccountId": "uuid o null",
    "companyId": "uuid o null",
    "amount": "125.50"
  }
}
```

Account Service responde en `transaction_queue` con uno de estos eventos:

| Evento | Significado | Campo adicional |
| --- | --- | --- |
| `FundsReserved` | El monto se movio a `reservedBalance`. | Ninguno |
| `FundsReservationRejected` | No se pudo reservar el monto. | `payload.reason` |
| `FundsCommitted` | La reserva fue consumida y el movimiento fue aplicado. | Ninguno |
| `FundsReleased` | La reserva fue devuelta a `balance`. | `payload.reason` |

Todos conservan el mismo `correlationId` y el mismo contenido base de `payload`. Un ejemplo de fallo es:

```json
{
  "eventId": "correlationId:funds-released",
  "eventType": "FundsReleased",
  "correlationId": "uuid",
  "producer": "account-service",
  "payload": {
    "sourceAccountId": "uuid",
    "targetAccountId": "uuid",
    "companyId": null,
    "amount": "125.50",
    "reason": "Target account not found"
  }
}
```

## Contratos de pago de servicios

Payment Service invoca a Transaction Service mediante el RPC `create_payment_transaction` después de crear el pago en estado `PENDING`:

```json
{
  "sourceAccount": "uuid",
  "companyId": "uuid",
  "amount": 125.5,
  "authorization": "Bearer <jwt>",
  "correlationId": "uuid"
}
```

Cuando Account Service confirma o libera la reserva, Transaction Service publica uno de estos eventos para que Payment Service actualice el pago:

```json
{
  "eventId": "correlationId:payment-transaction-completed",
  "correlationId": "uuid"
}
```

`PaymentTransactionCompleted` usa el contrato anterior y cambia el pago a `APPROVED`. `PaymentTransactionFailed` agrega `reason` y cambia el pago a `REJECTED`:

```json
{
  "eventId": "correlationId:payment-transaction-failed",
  "correlationId": "uuid",
  "reason": "Insufficient funds or account inactive"
}
```

Estos dos eventos no incluyen actualmente `eventType`, `eventVersion`, `occurredAt`, `causationId`, `producer` ni un objeto `payload`.

## Garantías implementadas

| Componente                   | Comportamiento verificable                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer Service             | Usa outbox transaccional y reintenta la publicación a los 5, 15 y 30 segundos. Si agota los intentos, guarda `failedAt`; no enruta el mensaje a una DLQ. |
| Account Service              | Registra eventos procesados y una reserva unica por `correlationId`; confirmar o liberar una reserva son transiciones excluyentes.                         |
| Transaction Service          | Registra eventos procesados y valida las transiciones de estado para no modificar transacciones terminales.                                               |
| Notification & Audit Service | Evita duplicar el registro de auditoría mediante `eventId`, pero no evita reenviar la notificación simulada.                                             |
| Payment Service              | Registra eventos procesados para evitar actualizar más de una vez el estado ante `PaymentTransactionCompleted` y `PaymentTransactionFailed`.             |

No hay configuración de Dead Letter Queue, reintentos de consumo, `ack`/`nack` manual ni validación uniforme del sobre de eventos.

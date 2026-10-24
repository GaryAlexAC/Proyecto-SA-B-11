# Catalogo de eventos implementados

## Topologia RabbitMQ

| Cola | Servicio consumidor | Mensajes relacionados con la Saga |
| --- | --- | --- |
| `account_queue` | Account Service | `TransactionRequested`, `TransactionProcessing` |
| `transaction_queue` | Transaction Service | `FundsReserved`, `FundsReservationRejected`, `FundsCommitted`, `FundsReleased`, RPC de transacciones |
| `payment_queue` | Payment Service | `PaymentTransactionCompleted`, `PaymentTransactionFailed`, RPC de pagos |
| `notification_queue` | Notification & Audit Service | `TransferRequested`, `TransferCompleted`, `TransferFailed`, eventos de clientes y pagos |
| `customer_queue` | Customer Service | RPC de clientes y autenticacion |

No se agregaron colas nuevas para la Saga coreografiada. Los eventos nuevos usan las colas durables que ya pertenecen a cada microservicio.

Los eventos publicados por el outbox incluyen metadatos de trazabilidad como
`eventId`, `eventType`, `eventVersion`, `occurredAt`, `correlationId`,
`causationId`, `producer`, `payload` y, cuando corresponde, `traceparent`.
Estos campos permiten relacionar métricas, logs y trazas sin incluir
identificadores de alta cardinalidad en las etiquetas de Prometheus.

## Saga de transacciones

| Mensaje | Productor | Cola / consumidor | Funcion |
| --- | --- | --- | --- |
| `TransactionRequested` | Transaction Service | `account_queue` / Account Service | Inicia la reserva de fondos. |
| `FundsReserved` | Account Service | `transaction_queue` / Transaction Service | Confirma que el monto paso de disponible a reservado. |
| `FundsReservationRejected` | Account Service | `transaction_queue` / Transaction Service | Informa que no pudo crearse la reserva. |
| `TransactionProcessing` | Transaction Service | `account_queue` / Account Service | Informa que la transaccion esta lista para confirmar la reserva. |
| `FundsCommitted` | Account Service | `transaction_queue` / Transaction Service | Confirma el consumo de la reserva y, para transferencias, el credito al destino. |
| `FundsReleased` | Account Service | `transaction_queue` / Transaction Service | Confirma que la reserva fue devuelta al saldo disponible. |
| `TransferRequested` | Transaction Service | `notification_queue` / Notification Service | Registra la solicitud para auditoria. |
| `TransferCompleted` | Transaction Service | `notification_queue` / Notification Service | Registra y notifica el resultado exitoso. |
| `TransferFailed` | Transaction Service | `notification_queue` / Notification Service | Registra y notifica el resultado fallido. |

Los comandos `ReserveFunds`, `CreditDestination` y `ReleaseFunds`, y los eventos `DestinationCredited` y `DestinationCreditRejected`, fueron reemplazados por la coreografia anterior.

## Pagos de servicios

| Mensaje | Tipo | Productor | Consumidor |
| --- | --- | --- | --- |
| `create_payment_transaction` | RPC | Payment Service | Transaction Service |
| `PaymentTransactionCompleted` | Evento | Transaction Service | Payment Service |
| `PaymentTransactionFailed` | Evento | Transaction Service | Payment Service |
| `PaymentApproved` | Evento | No hay productor implementado | Notification & Audit Service |
| `PaymentRejected` | Evento | No hay productor implementado | Notification & Audit Service |

## Customer Service

| Mensaje publicado | Consumidor implementado |
| --- | --- |
| `CustomerRegistered` | Notification & Audit Service |
| `ActivationEmailRequested` | Notification & Audit Service |
| `CustomerActivated` | Notification & Audit Service |
| `CustomerBlocked` | Notification & Audit Service |

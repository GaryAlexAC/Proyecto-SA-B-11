# Catálogo de eventos implementados

Este catálogo contiene únicamente mensajes publicados y consumidos por el código actual.

## Customer Service

| Mensaje publicado | Consumidor implementado | Implementación |
| --- | --- | --- |
| `CustomerRegistered` | Notification & Audit Service | `apps/customer-service/dist/infrastructure/messaging/messaging.service.js` |
| `ActivationEmailRequested` | Notification & Audit Service | `apps/customer-service/dist/infrastructure/messaging/messaging.service.js` |
| `CustomerActivated` | Notification & Audit Service | `apps/customer-service/dist/infrastructure/messaging/messaging.service.js` |
| `CustomerBlocked` | Notification & Audit Service | `apps/customer-service/dist/infrastructure/messaging/messaging.service.js` |

## Account Service

| Mensaje | Tipo | Productor | Consumidor |
| --- | --- | --- | --- |
| `ReserveFunds`, `CreditDestination`, `ReleaseFunds` | Comando | Transaction Service | Account Service |
| `FundsReserved`, `FundsReservationRejected`, `DestinationCredited`, `DestinationCreditRejected`, `FundsReleased` | Evento | Account Service | Transaction Service |

## Transaction Service

| Mensaje publicado | Consumidor implementado | Implementación |
| --- | --- | --- |
| `TransferRequested` | Notification & Audit Service | `apps/transaction-service/src/transactions/transactions.service.ts` |

## Payment Service

| Mensaje publicado | Consumidor implementado | Implementación |
| --- | --- | --- |
| `PaymentApproved` | Notification & Audit Service | `apps/payment-service/src/payments/payments.service.ts` |
| `PaymentRejected` | Notification & Audit Service | `apps/payment-service/src/payments/payments.service.ts` |

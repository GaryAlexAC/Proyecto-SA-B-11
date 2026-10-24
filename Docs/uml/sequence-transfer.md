# Diagrama de secuencia - Transferencia

![Secuencia de transferencia exitosa](../img/SecuensTransfer.png)

Transaction Service coordina la transferencia mediante una Saga: reserva fondos, acredita la cuenta destino y confirma el débito. Cada mensaje conserva el mismo `correlationId`.

La solicitud HTTP inicia una traza técnica en API Gateway. El `correlationId`
identifica la operación de negocio y `traceparent` continúa la traza a través de
RabbitMQ. Los eventos incluyen `occurredAt` para medir el tiempo de consumo.

```mermaid
sequenceDiagram
    actor User as Cliente
    participant UI as Frontend
    participant GW as API Gateway
    participant TX as Transaction Service
    participant AC as Account Service
    participant NO as Notification Service
    participant DB as PostgreSQL

    User->>UI: Solicitar transferencia
    UI->>GW: POST /transactions\ncorrelationId + traceparent
    Note over GW: Inicia span HTTP\nregistra request y latencia
    GW->>TX: create_transaction\ncorrelationId + traceparent
    Note over TX: Crea Transaction en PENDING\ny registra el evento outbox
    TX->>AC: TransactionRequested\noccurredAt + traceparent
    AC->>DB: Reservar fondos
    AC-->>TX: FundsReserved
    TX->>AC: TransactionProcessing
    AC->>DB: Confirmar reserva y acreditar destino
    AC-->>TX: FundsCommitted
    TX->>DB: Cambiar estado a COMPLETED/APPROVED
    TX->>NO: TransferCompleted\ncorrelationId + traceparent
    NO->>DB: Registrar auditoría
    NO-->>User: Notificación de transferencia

    alt Fallo de reserva o confirmación
        AC-->>TX: FundsReservationRejected o FundsReleased
        TX->>DB: Cambiar estado a FAILED
        TX->>NO: TransferFailed\ncorrelationId + traceparent
        NO->>DB: Registrar auditoría del fallo
    end
```

La imagen es una exportación estática; el bloque Mermaid anterior es la fuente
editable del diagrama.

# Diagrama de secuencia - Creación de cuenta

![Secuencia de creación de cuentas](../img/SecuensCreateAccount.png)

La creación de una cuenta es responsabilidad de Account Service. La cuenta queda asociada al cliente mediante `customerId` y el servicio publica los eventos correspondientes para notificación y auditoría.

La operación conserva `correlationId` y `traceparent` desde API Gateway hasta
Account Service. La latencia HTTP, el resultado de la operación y la publicación
del evento quedan disponibles para observabilidad.

```mermaid
sequenceDiagram
    actor User as Usuario o cajero
    participant UI as Frontend
    participant GW as API Gateway
    participant AC as Account Service
    participant DB as PostgreSQL
    participant MQ as RabbitMQ
    participant NO as Notification Service

    User->>UI: Registrar cuenta
    UI->>GW: POST /accounts\ncorrelationId + traceparent
    Note over GW: Inicia span HTTP\nregistra latencia y estado
    GW->>AC: create_account\ncustomerId + traceparent
    Note over AC: Valida customerId\ny reglas de tipo de cuenta
    AC->>DB: Crear cuenta y saldo inicial
    DB-->>AC: Cuenta creada
    AC->>MQ: AccountCreated\noccurredAt + correlationId
    MQ->>NO: AccountCreated\ntraceparent
    NO->>DB: Registrar auditoría
    AC-->>GW: Cuenta creada
    GW-->>UI: 201 Created
    UI-->>User: Mostrar cuenta creada
```

La imagen es una exportación estática; el bloque Mermaid anterior es la fuente
editable del diagrama.

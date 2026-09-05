# Modelo de dominio

## Entidades y estados

| Entidad | Responsabilidad | Estados |
| --- | --- | --- |
| Cliente | Información, credenciales y ciclo de vida del cliente. | `ACTIVE`, `INACTIVE`, `BLOCKED` |
| Cuenta | Cuenta monetaria o de ahorro, saldo y fondos reservados. | `ACTIVE`, `INACTIVE`, `BLOCKED` |
| Transferencia | Operación entre cuenta origen y destino. | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `COMPENSATING` |
| Pago | Solicitud y resultado de un pago. | `PENDING`, `PROCESSING`, `APPROVED`, `REJECTED` |
| Auditoría | Registro de eventos y operaciones relevantes. | No aplica |

## Reglas de negocio

| ID | Regla |
| --- | --- |
| RN-01 | El documento y el correo deben ser únicos. |
| RN-02 | El username debe ser único. |
| RN-03 | Solo un usuario activo puede recibir un JWT operativo. |
| RN-05 | Una cuenta pertenece exclusivamente a un cliente. |
| RN-06 | Una cuenta debe ser monetaria o de ahorro. |
| RN-07 | Una cuenta bloqueada o inactiva no puede originar transferencias. |
| RN-08 | El monto de una operación debe ser mayor que cero. |
| RN-09 | Una cuenta no puede transferirse dinero a sí misma. |
| RN-10 | `balance` representa el saldo disponible y debe cubrir el monto solicitado. |
| RN-11 | Al reservar, el monto se mueve de `balance` a `reservedBalance`; al confirmar se consume la reserva y al fallar se devuelve a `balance`. |
| RN-12 | Una solicitud repetida con la misma clave de idempotencia no genera otra operación. |
| RN-16 | Una cuenta se desactiva tras seis meses sin actividad y saldo menor a Q50.00. |

## Diagramas Entidad-Relación (ER) por Microservicio

A continuación se presentan los diagramas de Entidad-Relación para las bases de datos independientes de cada microservicio.

### Customer Service
```mermaid
erDiagram
    Customer {
        string id PK
        string fullName
        string document UK
        string email UK
        datetime birthDate
        string address
        bytes identityPhoto
        string identityPhotoMimeType
        string passwordHash
        string username UK
        CustomerRole role
        CustomerStatus status
        string activationTokenHash UK
        datetime activationTokenExpiresAt
        datetime activatedAt
        int version
        datetime createdAt
        datetime updatedAt
    }
    IdempotencyRecord {
        string key PK
        string operation
        string resourceId
        datetime createdAt
    }
    OutboxEvent {
        string id PK
        string eventType
        int eventVersion
        datetime occurredAt
        string correlationId
        string causationId
        string producer
        json payload
        int attempts
        datetime nextAttemptAt
        datetime publishedAt
        datetime failedAt
        string lastError
    }
```

`Customer`, `IdempotencyRecord` y `OutboxEvent` no tienen claves foráneas entre sí.

### Account Service
```mermaid
erDiagram
    Account {
        string id PK
        string customerId
        AccountType type
        decimal balance
        decimal reservedBalance
        AccountStatus status
        datetime lastActivity
        datetime createdAt
        datetime updatedAt
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        datetime processedAt
        string accountId FK
    }
    FundReservation {
        string id PK
        string correlationId UK
        string sourceAccountId FK
        string targetAccountId
        decimal amount
        ReservationStatus status
        datetime createdAt
        datetime updatedAt
    }
    Account ||--o{ ProcessedEvent : "procesa"
    Account ||--o{ FundReservation : "reserva"
```

`Account.customerId` es una referencia lógica a `Customer` en Customer Service; no existe una clave foránea entre bases de datos. `FundReservation.targetAccountId` es una referencia logica porque puede ser nulo para pagos de servicios.

### Transaction Service
```mermaid
erDiagram
    Transaction {
        string id PK
        string correlationId UK
        string sourceAccountId
        string targetAccountId
        string companyId
        decimal amount
        TransactionStatus status
        string failReason
        datetime createdAt
        datetime updatedAt
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        datetime processedAt
        string transactionId FK
    }
    Transaction ||--o{ ProcessedEvent : "procesa"
```

`Transaction.sourceAccountId` y `Transaction.targetAccountId` son referencias lógicas a `Account` en Account Service. `Transaction.companyId` es una referencia lógica al UUID de `Company` en Payment Service. No existen claves foráneas entre bases de datos.

### Payment Service
```mermaid
erDiagram
    Payment {
        string id PK
        string transactionId
        string correlationId UK
        decimal amount
        PaymentStatus status
        PaymentType type
        string description
        string failReason
        datetime createdAt
        datetime updatedAt
    }
    Company {
        string id PK
        string name UK
        datetime createdAt
        datetime updatedAt
    }
    Service {
        string id PK
        string companyId FK
        string name
        decimal amount
        datetime createdAt
        datetime updatedAt
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        datetime processedAt
        string paymentId FK
    }
    Company ||--o{ Service : "ofrece"
    Payment ||--o{ ProcessedEvent : "procesa"
```

`Payment.transactionId` es una referencia lógica a `Transaction` en Transaction Service; no existe una clave foránea entre bases de datos. `Company.id` es el UUID referenciado por `Transaction.companyId` para las transacciones de servicios externos.

### Notification & Audit Service
```mermaid
erDiagram
    AuditLog {
        int id PK
        string eventId UK
        string eventType
        int eventVersion
        string correlationId
        string causationId
        string producer
        json payload
        datetime occurredAt
        datetime consumedAt
    }
```

`AuditLog` no tiene claves foráneas. Sus identificadores de correlación y causalidad vinculan eventos entre servicios a nivel de mensajería.

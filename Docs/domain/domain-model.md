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
| RN-10 | El saldo disponible debe cubrir el monto solicitado. |
| RN-11 | Los fondos reservados no forman parte del saldo disponible. |
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
        string passwordHash
        string username UK
        CustomerRole role
        CustomerStatus status
    }
```

### Account Service
```mermaid
erDiagram
    Account {
        string id PK
        string customerId FK
        AccountType type
        decimal balance
        AccountStatus status
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        string accountId FK
    }
    Account ||--o{ ProcessedEvent : "procesa"
```

### Transaction Service
```mermaid
erDiagram
    Transaction {
        string id PK
        string correlationId UK
        string sourceAccountId FK
        string targetAccountId FK
        decimal amount
        TransactionStatus status
        string failReason
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        string transactionId FK
    }
    Transaction ||--o{ ProcessedEvent : "procesa"
```

### Payment Service
```mermaid
erDiagram
    Payment {
        string id PK
        string transactionId FK
        string correlationId UK
        decimal amount
        PaymentStatus status
        PaymentType type
    }
    ProcessedEvent {
        string id PK
        string eventId UK
        string paymentId FK
    }
    Payment ||--o{ ProcessedEvent : "procesa"
```

### Notification & Audit Service
```mermaid
erDiagram
    AuditLog {
        int id PK
        string eventId UK
        string eventType
        string correlationId
        string producer
        json payload
        datetime occurredAt
    }
```

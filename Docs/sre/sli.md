# Service Level Indicators

## Disponibilidad

```text
solicitudes válidas atendidas en API Gateway /
solicitudes válidas totales en API Gateway * 100
```

## Tasa de errores

```text
errores 5xx / requests * 100
```

## Latencia de requests de lectura

```text
percentil 95 de la duración de requests HTTP de lectura
```

## Latencia de creación de operación

```text
percentil 95 de la duración de requests HTTP que crean operaciones
```

## Transferencias procesadas correctamente

```text
transferencias finalizadas (APPROVED en la implementación) /
transferencias aceptadas * 100
```

## Operaciones financieras sin error técnico

```text
operaciones financieras finalizadas sin error técnico / operaciones financieras aceptadas * 100
```

## Tiempo de procesamiento de eventos

```text
instante de consumo observado - occurredAt
```

El valor se registra mediante `bank_event_processing_duration_ms`. El sistema
no persiste un campo `consumedAt`; el consumidor calcula la edad del evento al
procesarlo.

## Eventos agotados del outbox (DLQ lógica)

```text
eventos con failedAt / eventos publicados * 100
```

El sistema no utiliza una cola RabbitMQ DLQ física. `failedAt` representa el
evento que agotó los reintentos del outbox.

## Tiempo de procesamiento de notificaciones

```text
notificaciones procesadas antes de 30 segundos / notificaciones recibidas * 100
```

# Service Level Indicators

## Disponibilidad

```text
solicitudes válidas atendidas / solicitudes válidas totales * 100
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
transferencias COMPLETED / transferencias aceptadas * 100
```

## Operaciones financieras sin error técnico

```text
operaciones financieras finalizadas sin error técnico / operaciones financieras aceptadas * 100
```

## Tiempo de procesamiento de eventos

```text
consumedAt - occurredAt
```

## Mensajes enviados a DLQ

```text
mensajes enviados a DLQ / mensajes publicados * 100
```

## Tiempo de procesamiento de notificaciones

```text
notificaciones procesadas antes de 30 segundos / notificaciones recibidas * 100
```

# SLO y error budget

Los valores objetivo deben conservar los definidos en la Fase 1. En esta fase
se calculan sobre series reales de Prometheus y se muestran en Grafana.

## Disponibilidad

```promql
sum(rate(bank_requests_total{service_name="api-gateway",status!~"5.."}[30d]))
/ sum(rate(bank_requests_total{service_name="api-gateway"}[30d]))
```

## Error budget

Para un SLO de disponibilidad `S`, el error budget permitido es `1-S`. El
presupuesto restante se calcula como:

```text
budget_restante = 1 - (errores_observados / solicitudes_totales) / (1 - S)
```

Las reglas versionadas en `observability/prometheus-rules.yaml` incluyen
alertas operativas, incluida una alerta de burn rate y las alertas de estos
indicadores adicionales.

Disponibilidad mensual del API Gateway:

```promql
sum(rate(bank_requests_total{service_name="api-gateway",status!~"5.."}[30d]))
/ sum(rate(bank_requests_total{service_name="api-gateway"}[30d]))
```

Latencia p95 de requests de lectura:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(bank_operation_duration_ms_bucket{service_name="api-gateway",operation=~"GET .*"}[5m]))
)
```

Latencia p95 de creación de operación:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(bank_operation_duration_ms_bucket{service_name="api-gateway",operation=~"POST .*|PUT .*|PATCH .*"}[5m]))
)
```

## Indicadores adicionales

Procesamiento de eventos antes de cinco segundos:

```promql
sum(rate(bank_event_processing_duration_ms_bucket{le="5000"}[5m]))
/ clamp_min(sum(rate(bank_event_processing_duration_ms_count[5m])), 1)
```

Eventos agotados del outbox, tratados como DLQ lógica:

```promql
sum(rate(bank_events_dlq_total[5m]))
/ clamp_min(sum(rate(bank_events_published_total[5m])), 1)
```

Notificaciones procesadas antes de treinta segundos:

```promql
sum(rate(bank_notification_processing_duration_ms_bucket{le="30000"}[5m]))
/ clamp_min(sum(rate(bank_notification_processing_duration_ms_count[5m])), 1)
```

Las métricas con `_bucket` y `_count` son histogramas. El numerador cuenta
observaciones dentro del objetivo y el denominador cuenta todas las observaciones.

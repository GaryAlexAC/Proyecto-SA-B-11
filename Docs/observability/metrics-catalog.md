# Catálogo de métricas

| Métrica | Tipo | Etiquetas | Uso |
| --- | --- | --- | --- |
| `transaction_duration_ms` | Histograma | `operation`, `status` | p50, p95 y p99 del flujo Saga |
| `transaction_success_total` | Counter | `operation` | Tasa de éxito |
| `transaction_failures_total` | Counter | `operation` | Tasa de fallo |
| `account_transactions_total` | Counter | `account_type`, `operation` | Débitos y créditos |
| `account_anomalies_detected_total` | Counter | `operation` | Anomalías de frecuencia |
| `customer_kyc_verified_total` | Counter | ninguna | Clientes verificados |
| `customer_kyc_rejected_total` | Counter | ninguna | Clientes rechazados |
| `customer_kyc_duration_ms` | Histograma | ninguna | Tiempo creación-verificación |
| `payment_external_failures_total` | Counter | `failure_type` | Fallos y timeouts simulados |
| `payment_external_latency_ms` | Histograma | ninguna | p95 del externo simulado |
| `bank_event_processing_duration_ms` | Histograma | `operation`, `status` | Tiempo desde `occurredAt` hasta el consumo del evento |
| `bank_events_published_total` | Counter | `operation` | Eventos publicados correctamente desde el outbox |
| `bank_events_dlq_total` | Counter | `operation` | Eventos agotados después de todos los reintentos del outbox |
| `bank_notifications_total` | Counter | `notification_type`, `status` | Notificaciones procesadas por tipo y resultado |
| `bank_notification_processing_duration_ms` | Histograma | `notification_type`, `status` | Tiempo de procesamiento de una notificación |

Las métricas de latencia son histogramas, no promedios. Prometheus calcula los
percentiles con `histogram_quantile`.

El outbox marca con `failedAt` los eventos que agotaron sus reintentos. Esa
condición representa la DLQ lógica del sistema y se expone mediante
`bank_events_dlq_total`.

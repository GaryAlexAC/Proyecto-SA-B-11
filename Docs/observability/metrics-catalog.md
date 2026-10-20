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

Las métricas de latencia son histogramas, no promedios. Prometheus calcula los
percentiles con `histogram_quantile`.

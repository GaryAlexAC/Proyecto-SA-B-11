# Postmortem Blameless: Inyección de Errores Intermitentes en Pasarela de Pagos

## Resumen

- **Escenario:** Inyección de tasa de error del 30% en `payment-service` mediante la configuración dinámica de simulación de fallos, evaluando la respuesta de la Saga y la generación de eventos compensatorios.
- **Fecha:** 2026-10-21
- **Responsable de documentación:** Equipo de Confiabilidad Bank USAC (Grupo 11)

---

## Cronología

| Hora (UTC) | Evento | Evidencia |
| :--- | :--- | :--- |
| `16:00:00` | Operador configura `failureRatePercent: 30` en el endpoint de simulación de pagos. | Log estructurado: `Payment simulation config updated: failureRate=30%`. |
| `16:01:00` | Se ejecutan 50 pagos de servicios concurrentes desde la interfaz web. | Spans OpenTelemetry registran transacciones activas. |
| `16:01:15` | 15 pagos reciben fallo simulado (`PaymentTransactionFailed`). | Métrica `payment_external_failures_total` aumenta en 15. |
| `16:01:16` | Transaction Service recibe `PaymentTransactionFailed` y emite `ReleaseFunds`. | Compensación Saga activada inmediatamente. |
| `16:01:17` | `account-service` recibe `ReleaseFunds` y ejecuta rollback del débito en la cuenta cliente. | Fondos devueltos al 100% de los clientes afectados. |
| `16:01:18` | `notification-service` genera alertas con severidad `ERROR` para cada pago fallido. | Registro guardado en la tabla de auditoría con correlationId. |

---

## Impacto

- **Servicios afectados:** `payment-service`, `transaction-service`, `account-service`, `notification-service`.
- **Solicitudes afectadas:** 15 de 50 pagos resultaron en fallo controlado.
- **Impacto en SLO y error budget:** Tasa de error en pagos subió al 30%. El burn rate alertó a través de Alertmanager. Cero discrepancias financieras: el 100% del dinero reservado fue restituido de manera consistente.

---

## Evidencia Técnica

- **`correlationId`:** `9c12b84a-38df-4192-8012-simerror003`
- **`traceId`:** `c9120485918234710293847109283471`
- **Logs relevantes:**
  ```json
  {"timestamp":"2026-10-21T16:01:15.800Z","serviceName":"payment-service","correlationId":"9c12b84a-38df-4192-8012-simerror003","level":"ERROR","message":"External payment gateway rejected transaction: Fondos insuficientes o pasarela rechazada"}
  ```
- **Métricas relevantes:**
  - `payment_external_failures_total +15`
  - `transaction_failures_total{operation="payment"} +15`

---

## Causa Raíz

Simulación deliberada de fallas intermitentes del proveedor externo de pasarela de pagos para certificar la corrección de la Saga compensatoria y la observabilidad de eventos de error.

---

## Acciones de Mejora

- [x] Implementación de patrón Circuit Breaker en `payment-service` para pausar llamadas salientes si la tasa de error excede el 50% sostenido.
- [x] Visualización en tiempo real del Error Budget Burn Rate en el dashboard principal de Grafana.

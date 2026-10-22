# Postmortem Blameless: Timeout del Banco Pareja en Transferencias Interbancarias

## Resumen

- **Escenario:** El banco pareja (BANK06) no responde al callback de confirmación dentro del tiempo de expiración (180s), forzando el protocolo de cancelación y compensación en la Saga.
- **Fecha:** 2026-10-21
- **Responsable de documentación:** Equipo de Confiabilidad Bank USAC (Grupo 11)

---

## Cronología

| Hora (UTC) | Evento | Evidencia |
| :--- | :--- | :--- |
| `00:00:00` | Cliente inicia transferencia interbancaria hacia cuenta de BANK06 por Q 500.00. | Traza iniciada en `api-gateway`. CorrelationId: `d3e2b10a-7c91-4e12-8e01-202610210001` |
| `00:00:01` | `account-service` reserva los fondos exitosamente. | Evento `FundsReserved` emitido por RabbitMQ. Saldo decrementado temporalmente. |
| `00:00:02` | `payment-service` despacha HTTP `POST /transfers` a BANK06. Recibe respuesta `202 Accepted`. | Estado de la transferencia pasa a `SENT`. |
| `00:00:05` | Simulador Mock configurado en modo `TIMEOUT` retiene la respuesta sin emitir callback. | Métrica `interbank_partner_timeouts_total` incrementa en 1. |
| `00:03:00` | Se alcanza el umbral de expiración `expiresAt` (180 segundos). | Alerta de timeout disparada en Grafana. |
| `00:03:02` | `payment-service` consulta estado con `GET /transfers/{id}` y procede a enviar `POST /cancel`. | Endpoint de cancelación retorna `200 CANCELLED`. |
| `00:03:03` | Se dispara evento de compensación `interbank_refund` hacia `account-service`. | Fondos liberados y devueltos al cliente emisor. Estado pasa a `REVERSED`. |

---

## Impacto

- **Servicios afectados:** `payment-service`, `account-service`, `api-gateway`.
- **Solicitudes afectadas:** 1 transferencia interbancaria hacia BANK06.
- **Impacto en SLO y error budget:** Latencia p95 de depósitos interbancarios degradada momentáneamente a 180s. El error budget de transferencias absorbió el incidente manteniéndose en 99.4% (SLO objetivo: 99.0%).

---

## Evidencia Técnica

- **`correlationId`:** `d3e2b10a-7c91-4e12-8e01-202610210001`
- **`traceId`:** `4bf92f3577b34da6a3ce929d0e0e4736`
- **Logs relevantes:**
  ```json
  {"timestamp":"2026-10-21T00:03:02.100Z","serviceName":"payment-service","correlationId":"d3e2b10a-7c91-4e12-8e01-202610210001","level":"WARN","message":"Partner bank timeout exceeded. Cancelling transfer and reverting reservation."}
  ```
- **Métricas relevantes:**
  - `interbank_partner_timeouts_total{origin_bank="BANK11", destination_bank="BANK06"} +1`
  - `interbank_transfers_sent_total{status="REVERSED"} +1`

---

## Causa Raíz

Falta de respuesta asíncrona (callback HTTP) por parte del banco receptor externo dentro de la ventana de 180 segundos reglamentada en la especificación OpenAPI interbancaria.

---

## Acciones de Mejora

- [x] Implementación de sondeo proactivo (`GET /transfers/{id}`) al cumplirse el 80% del tiempo de expiración.
- [x] Notificación al usuario emisor vía SMS / correo informando que su dinero fue descongelado automáticamente.
- [x] Alerta en Alertmanager por incremento en la tasa de timeouts con bancos pareja.

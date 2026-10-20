# Runbook: fallos externos simulados

1. Consultar la configuración actual en `GET /api/payments/simulation/config`.
2. Revisar `payment_external_failures_total` y su tipo de fallo.
3. Confirmar los spans `PaymentTimeout` y las compensaciones.
4. Restaurar una configuración controlada después de la prueba.
5. Adjuntar logs, métricas y trazas al postmortem.

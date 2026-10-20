# Runbook: tasa de errores alta

1. Revisar `bank_errors_total` y agrupar por servicio.
2. Buscar el `traceId` de una operación fallida en Grafana/Tempo.
3. Consultar sus logs por `correlationId` en Loki.
4. Si la causa es Payment Service, reducir temporalmente la tasa de simulación.
5. Confirmar que la Saga haya ejecutado la compensación.

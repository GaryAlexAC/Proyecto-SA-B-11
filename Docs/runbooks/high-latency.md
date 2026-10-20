# Runbook: latencia alta

1. Revisar el p95 y p99 de `transaction_duration_ms`.
2. Abrir una traza lenta en Tempo y localizar el span con mayor duración.
3. Revisar CPU, memoria, pods y consumer lag.
4. Validar si Payment Service tiene latencia simulada activa.
5. Mitigar escalando el deployment o eliminando la latencia controlada.

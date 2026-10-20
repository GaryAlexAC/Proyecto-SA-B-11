# Runbook: consumer lag

1. Revisar las colas con mensajes pendientes en RabbitMQ.
2. Confirmar el estado de los consumidores y sus pods.
3. Buscar errores de conexión en Loki.
4. Escalar el consumidor mediante HPA si la carga es sostenida.
5. Verificar que no existan mensajes bloqueados por errores permanentes.

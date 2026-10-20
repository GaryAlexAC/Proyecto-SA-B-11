# Observabilidad

La observabilidad de Bank USAC usa OpenTelemetry en el API Gateway y los cinco
microservicios. Las trazas se exportan por OTLP al Collector, las métricas se
exponen para Prometheus y los logs se escriben como JSON a stdout para que el
agente de infraestructura los envíe a Loki.

## Desarrollo local

```bash
docker compose up --build -d
```

- Grafana: `http://localhost:3002` (`admin` / `admin`)
- Prometheus: `http://localhost:9090`
- Tempo: `http://localhost:3200`
- Loki: `http://localhost:3100`

La retención local se limita a siete días para evitar consumo innecesario de
recursos.

## Contexto distribuido

- `correlationId` identifica la operación de negocio.
- `traceId` identifica la traza técnica.
- `traceparent` se transporta en los mensajes de RabbitMQ.
- Cada consumidor crea un span `CONSUMER` asociado al span del productor.

Los atributos de métricas no contienen `accountId`, `customerId` ni otros
identificadores de alta cardinalidad. Esos valores solo aparecen en logs cuando
son necesarios para investigar una operación.

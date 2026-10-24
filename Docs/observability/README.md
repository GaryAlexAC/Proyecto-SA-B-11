# Observabilidad

La observabilidad de Bank USAC usa OpenTelemetry en el API Gateway y los cinco
microservicios. Las trazas se exportan por OTLP al Collector y Tempo, las
métricas se exponen para Prometheus y los logs se escriben como JSON a stdout
para que el agente de infraestructura los envíe a Loki. Alertmanager gestiona
las alertas y RabbitMQ Exporter expone métricas del broker.

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

## Documentos relacionados

- [Catálogo de métricas](metrics-catalog.md)
- [SLO y error budget](slo.md)
- [SLI](../sre/sli.md)
- [SLO](../sre/slo.md)
- [Runbooks](../runbooks/high-error-rate.md)

## Contexto distribuido

- `correlationId` identifica la operación de negocio.
- `traceId` identifica la traza técnica.
- `traceparent` se transporta en los mensajes de RabbitMQ.
- Cada consumidor crea un span `CONSUMER` asociado al span del productor.

Los eventos publicados por el outbox conservan `eventId`, `eventType`,
`eventVersion`, `occurredAt`, `correlationId`, `causationId`, `producer`,
`payload` y, cuando aplica, `traceparent`.

Los atributos de métricas no contienen `accountId`, `customerId` ni otros
identificadores de alta cardinalidad. Esos valores solo aparecen en logs cuando
son necesarios para investigar una operación.

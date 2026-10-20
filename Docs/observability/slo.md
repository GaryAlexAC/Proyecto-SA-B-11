# SLO y error budget

Los valores objetivo deben conservar los definidos en la Fase 1. En esta fase
se calculan sobre series reales de Prometheus y se muestran en Grafana.

## Disponibilidad

```promql
sum(rate(bank_requests_total{status!~"5.."}[30d]))
/ sum(rate(bank_requests_total[30d]))
```

## Error budget

Para un SLO de disponibilidad `S`, el error budget permitido es `1-S`. El
presupuesto restante se calcula como:

```text
budget_restante = 1 - (errores_observados / solicitudes_totales) / (1 - S)
```

Las reglas versionadas en `observability/prometheus-rules.yaml` incluyen cuatro
alertas operativas, incluida una alerta de burn rate.

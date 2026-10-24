# Operación SRE

La documentación SRE define cómo medir confiabilidad, cómo interpretar los
objetivos y cómo responder ante una degradación.

## Documentos

- [SLI](sli.md): fórmulas de disponibilidad, errores, latencia, eventos y notificaciones.
- [SLO](slo.md): objetivos cuantitativos del sistema.
- [SLA](sla.md): compromisos operativos adicionales del entorno académico.
- [Runbook de errores](../runbooks/high-error-rate.md).
- [Runbook de latencia](../runbooks/high-latency.md).
- [Runbook de consumer lag](../runbooks/consumer-lag.md).
- [Runbook de error budget](../runbooks/error-budget-burn-rate.md).
- [Runbook de simulación de pagos](../runbooks/payment-simulation.md).

## Relación entre SLI, SLO y SLA

- Un **SLI** es la medición observable del comportamiento del sistema.
- Un **SLO** define el objetivo que debe cumplir ese indicador.
- Un **SLA** expresa el compromiso operativo y las acciones ante incumplimiento.

Los SLI se calculan con las métricas expuestas por los servicios y recolectadas
por Prometheus. Grafana presenta los valores y Alertmanager notifica cuando se
incumplen los umbrales definidos.

## Error budget

Para un SLO de disponibilidad `S`, el error budget permitido es `1 - S`. El
presupuesto restante se calcula como:

```text
budget_restante = 1 - (errores_observados / solicitudes_totales) / (1 - S)
```

Cuando el presupuesto se consume rápidamente, se debe abrir el runbook de
error budget, revisar latencia, errores y disponibilidad, y registrar la
evidencia en un postmortem si existe impacto operativo.

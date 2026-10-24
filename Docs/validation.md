# Validación y operación

## Validación local

Desde la raíz del repositorio:

```bash
npm ci
npm run build
npm run lint
npm run test --workspaces --if-present
```

La validación cubre la compilación de la librería de observabilidad, generación
de clientes Prisma, compilación de microservicios y frontend, pruebas unitarias
y lint.

## Validación en Kubernetes

Después del despliegue en `dev`:

```bash
kubectl get pods -n dev
kubectl get svc -n dev
kubectl get hpa -n dev
kubectl rollout status deployment/api-gateway -n dev
kubectl rollout status deployment/transaction-service -n dev
```

También se debe confirmar que Grafana, Prometheus, Loki, Tempo, Alertmanager y
OpenTelemetry Collector estén disponibles en el namespace de observabilidad.

## Validación funcional

La prueba completa debe comprobar:

- Registro y activación de clientes.
- Validación KYC.
- Creación y consulta de cuentas.
- Transferencia exitosa y compensación de Saga.
- Pago externo simulado con éxito, rechazo y timeout.
- Registro de auditoría y notificación.
- Historial filtrado de transacciones.

## Evidencia

La evidencia debe incluir el resultado del pipeline, estado de los rollouts,
estado de los HPA, métricas de Grafana, trazas de Tempo, logs de Loki y las
alertas generadas durante las pruebas de fallo.

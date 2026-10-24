# Autoescalado HPA

El enunciado exige un Horizontal Pod Autoscaler por microservicio, con escalado
cuando el uso promedio de CPU alcanza el 80%.

## Configuración

La configuración se encuentra en:

- `charts/bank-usac/templates/hpa.yaml`
- `k8s/infra/hpa/hpa-all-services.yaml`

Cada HPA utiliza:

| Parámetro | Valor |
| --- | ---: |
| Réplicas mínimas | 1 |
| Réplicas máximas | 5 |
| Métrica | CPU |
| Objetivo promedio | 80% |

Los servicios cubiertos son API Gateway, Customer Service, Account Service,
Transaction Service, Payment Service y Notification Service.

## Verificación

```bash
kubectl get hpa -n dev
kubectl describe hpa api-gateway-hpa -n dev
kubectl top pods -n dev
```

El HPA escala Pods dentro del clúster GKE. No escala automáticamente el node
pool de Compute Engine.

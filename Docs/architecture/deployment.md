# Despliegue implementado

| Elemento | Implementación verificada |
| --- | --- |
| API Gateway | Deployment de una réplica y Service NodePort en `k8s/infra/api-gateway.yaml`. |
| Customer, Account, Transaction, Payment y Notification & Audit Service | Manifiestos Deployment y Service en `k8s/infra/`. |
| RabbitMQ | `docker-compose.yml` y Deployment de una réplica en `k8s/infra/rabbitmq-deployment.yaml`. |
| PostgreSQL | Docker Compose crea PostgreSQL; los manifiestos de los servicios usan una URL de PostgreSQL externa al clúster. |

No hay manifiestos de NGINX Ingress, ConfigMap, Secret, Prometheus, Grafana, HPA, almacenamiento persistente para RabbitMQ ni PostgreSQL en Kubernetes.

Los servicios Transaction, Payment y Notification se inician solo como microservicios RabbitMQ. Sus manifiestos declaran un puerto y Service, pero no exponen un servidor HTTP. Sus sondas actuales no verifican conectividad con RabbitMQ ni PostgreSQL.

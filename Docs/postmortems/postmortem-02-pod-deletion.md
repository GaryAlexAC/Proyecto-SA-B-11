# Postmortem Blameless: Resiliencia ante Eliminación Inesperada de Pod (Chaos Injection)

## Resumen

- **Escenario:** Simulación de fallo en producción mediante la eliminación forzada (`kubectl delete pod`) de una réplica de `transaction-service` durante una prueba de carga constante de transferencias.
- **Fecha:** 2026-10-21
- **Responsable de documentación:** Equipo de Confiabilidad Bank USAC (Grupo 11)

---

## Cronología

| Hora (UTC) | Evento | Evidencia |
| :--- | :--- | :--- |
| `14:00:00` | Inicio de prueba de carga con k6 (100 transacciones concurrentes por segundo). | Throughput sube a 100 req/s. CPU de nodos al 65%. |
| `14:01:30` | Inyección de fallo: `kubectl delete pod -l app=transaction-service --force`. | Pod `transaction-service-6d8b9f-xyz` pasa a estado `Terminating`. |
| `14:01:32` | Kubernetes ReplicaSet detecta discrepancia de réplicas y provisiona pod sustituto. | Evento de K8s: `Created pod: transaction-service-6d8b9f-new`. |
| `14:01:33` | Mensajes en tránsito encolados en RabbitMQ permanecen seguros y no se pierden (`durable: true`). | Consumer lag se incrementa transitoriamente a 18 mensajes. |
| `14:01:45` | Nuevo pod completa readiness probe (`/health`) y se conecta a RabbitMQ. | Consumer lag desciende a 0. Procesamiento reanudado. |
| `14:02:00` | HPA escala la cantidad de réplicas debido al aumento temporal de CPU (>80%). | Replicas aumentan de 1 a 2 pods automáticamente. |

---

## Impacto

- **Servicios afectados:** `transaction-service`.
- **Solicitudes afectadas:** 0 transacciones perdidas. 12 transacciones experimentaron un aumento de latencia de 1.8 segundos mientras el nuevo pod tomaba la cola.
- **Impacto en SLO y error budget:** Tasa de disponibilidad del API Gateway se mantuvo en 100%. Latencia p99 se vio ligeramente afectada (2.4s) pero dentro del umbral de resiliencia.

---

## Evidencia Técnica

- **`correlationId`:** `f7a19c3e-52b8-4c11-9a71-20261021chaos01`
- **`traceId`:** `a8e91024b912384a910e1293847a9821`
- **Métricas relevantes:**
  - `rabbitmq_queue_messages_ready{queue="transaction_queue"}` subió temporalmente a 18 y volvió a 0.
  - `kube_deployment_status_replicas_available{deployment="transaction-service"}` bajó a 0 por 12 segundos y subió a 2.

---

## Causa Raíz

Terminación abrupta del contenedor primario de orquestación transaccional provocada intencionalmente para evaluar la resiliencia de colas durables y la capacidad de autorecuperación del clúster GKE.

---

## Acciones de Mejora

- [x] Configuración de `minReplicas: 2` en el HPA de producción para evitar cualquier instante con 0 réplicas activas durante reemplazos.
- [x] Implementación de `preStop` hook y `terminationGracePeriodSeconds: 30` para asegurar que el pod termine de procesar el mensaje RabbitMQ actual antes de salir.

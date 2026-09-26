# Service Level Agreement

## Acuerdo de Nivel de Servicio — Bank USAC

Bank USAC establece los siguientes compromisos de servicio para las funcionalidades principales expuestas mediante el API Gateway.

## Disponibilidad Garantizada

| Servicio | Disponibilidad mensual garantizada |
| --- | --- |
| API Gateway (punto de entrada) | ≥ 99.5 % |
| Customer Service (autenticación y registro) | ≥ 99.0 % |
| Account Service (consulta de saldo y cuentas) | ≥ 99.5 % |
| Transaction Service (transferencias) | ≥ 99.0 % |
| Payment Service (pagos) | ≥ 98.5 % |
| Notification & Audit Service | ≥ 98.0 % |

## Tiempos de Respuesta Garantizados

| Operación | Tiempo máximo (P95) |
| --- | --- |
| Consulta de saldo | < 500 ms |
| Login / autenticación | < 800 ms |
| Creación de cuenta | < 1 s |
| Inicio de transferencia (aceptación) | < 1 s |
| Procesamiento completo de transferencia (Saga) | < 10 s |
| Entrega de notificación de auditoría | < 30 s |

## Penalidades por Incumplimiento (entorno simulado)

| Disponibilidad real | Penalidad aplicable |
| --- | --- |
| 99.0 % – 99.49 % | Notificación formal al equipo SRE |
| 95.0 % – 98.99 % | Análisis post-mortem obligatorio en 24 h |
| < 95.0 % | Revisión de arquitectura y plan de remediación en 48 h |

## Exclusiones

El presente SLA **no aplica** en los siguientes casos:
- Mantenimiento planificado notificado con al menos 24 horas de anticipación.
- Fallos atribuibles exclusivamente a la infraestructura de Kubernetes local (minikube/kind/k3d).
- Fallos originados por indisponibilidad de la red local del entorno de pruebas.
- Eventos de fuerza mayor.

## Vigencia

Este acuerdo aplica durante el período de evaluación del sistema (ciclo académico 2S-2026) y será revisado al inicio de cada nueva fase del proyecto.

# C4 - Diagrama de contenedores cloud

Bank USAC se ejecuta en Google Cloud Platform (GCP). La interfaz web, el API Gateway, los
cinco microservicios, RabbitMQ y el stack de observabilidad se empaquetan como imágenes Docker almacenadas
en Artifact Registry y se ejecutan como Pods en Google Kubernetes Engine
(GKE).

| Contenedor C4 | Tecnología | Responsabilidad | Ubicación cloud |
| --- | --- | --- | --- |
| Frontend | React, TypeScript y Nginx | Presentar la interfaz por rol y reenviar `/api` al Gateway | Pod de GKE expuesto por Google Cloud Load Balancer (`34.29.251.106`) |
| API Gateway | NestJS | Punto de entrada de la API, autenticación y enrutamiento | Pod de GKE, Service LoadBalancer y ClusterIP |
| Customer Service | NestJS y Prisma | Clientes, autenticación, activación y KYC | Pod de GKE |
| Account Service | NestJS y Prisma | Cuentas, saldos, reservas, mínimos y comisiones | Pod de GKE |
| Transaction Service | NestJS y Prisma | Saga e historial de transferencias | Pod de GKE |
| Payment Service | NestJS y Prisma | Pagos internos/externos e integración interbancaria | Pod de GKE con integración REST con BANK06 |
| Notification Service | NestJS, Prisma y Nodemailer | Auditoría, severidad y notificaciones | Pod de GKE con salida hacia SMTP Gmail |
| RabbitMQ | RabbitMQ Management | Mensajería RPC y eventos entre servicios | Pod de GKE, acceso interno por AMQP |
| PostgreSQL | PostgreSQL sobre Ubuntu Server | Persistencia de cinco bases lógicas aisladas | VM `bank-usac-db` (`10.10.16.2`) en la subred de datos de la VPC |
| Stack de Observabilidad | Grafana, Prometheus, Loki, Alertmanager, OTel | Métricas, logs estructurados, alertas y trazas W3C | Pods de GKE en namespace `dev` (`136.64.164.78:3000`) |

El Frontend es el punto de entrada para los usuarios. Nginx entrega la SPA y
envía las solicitudes `/api/*` al API Gateway dentro del clúster. El Gateway se
comunica con los servicios mediante RabbitMQ y, cuando corresponde, mediante
HTTP interno. Ningún microservicio accede a la base lógica de otro servicio.

Aunque el modelo C4 representa cinco almacenes lógicos, físicamente todos se
encuentran en una sola instancia PostgreSQL alojada en una VM Compute Engine independiente del
clúster. La separación es por base de datos y credenciales de conexión, no por
máquina.

Artifact Registry y GitHub Actions forman parte del flujo de entrega continua (CI/CD):
GitHub Actions compila, prueba y empaqueta las imágenes Docker, las publica en
Artifact Registry y ordena a GKE realizar upgrades declarativos mediante Helm 3.

![Diagrama de contenedores](../img/ContainerDiagram.png)

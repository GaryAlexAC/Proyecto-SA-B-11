# C4 - Diagrama de contenedores cloud

Bank USAC se ejecuta en Microsoft Azure. La interfaz web, el API Gateway, los
cinco microservicios y RabbitMQ se empaquetan como imágenes Docker almacenadas
en Azure Container Registry y se ejecutan como Pods en Azure Kubernetes Service
(AKS).

| Contenedor C4 | Tecnología | Responsabilidad | Ubicación cloud |
| --- | --- | --- | --- |
| Frontend | React, TypeScript y Nginx | Presentar la interfaz por rol y reenviar `/api` al Gateway | Pod de AKS expuesto por Azure Load Balancer |
| API Gateway | NestJS | Punto de entrada de la API, autenticación y enrutamiento | Pod de AKS, Service interno y NodePort operativo |
| Customer Service | NestJS y Prisma | Clientes, autenticación, activación y KYC | Pod de AKS |
| Account Service | NestJS y Prisma | Cuentas, saldos, reservas, mínimos y comisiones | Pod de AKS |
| Transaction Service | NestJS y Prisma | Saga e historial de transferencias | Pod de AKS |
| Payment Service | NestJS y Prisma | Pagos internos/externos y simulación de proveedor | Pod de AKS |
| Notification Service | NestJS, Prisma y Nodemailer | Auditoría, severidad y notificaciones | Pod de AKS con salida hacia SMTP |
| RabbitMQ | RabbitMQ Management | Mensajería RPC y eventos entre servicios | Pod de AKS, acceso interno por AMQP |
| PostgreSQL | PostgreSQL sobre Ubuntu Server | Persistencia de cinco bases lógicas aisladas | VM `bank-usac-db` en la subred de datos |

El Frontend es el punto de entrada para los usuarios. Nginx entrega la SPA y
envía las solicitudes `/api/*` al API Gateway dentro del clúster. El Gateway se
comunica con los servicios mediante RabbitMQ y, cuando corresponde, mediante
HTTP interno. Ningún microservicio accede a la base lógica de otro servicio.

Aunque el modelo C4 representa cinco almacenes lógicos, físicamente todos se
encuentran en una sola instancia PostgreSQL alojada en una VM independiente del
clúster. La separación es por base de datos y credenciales de conexión, no por
máquina.

Azure Container Registry y GitHub Actions forman parte del flujo de entrega,
pero no del tráfico funcional del usuario: GitHub Actions publica imágenes en
ACR y ordena a AKS realizar rolling updates.

![Diagrama de contenedores](../img/ContainerDiagram.png)

> La imagen debe regenerarse con las fronteras `Microsoft Azure`, `AKS` y
> `VM PostgreSQL`, además de ACR y el proveedor SMTP externo.

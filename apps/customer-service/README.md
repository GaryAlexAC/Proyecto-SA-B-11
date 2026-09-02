# Customer Service

Microservicio NestJS responsable del ciclo de vida de los clientes de Bank USAC. Utiliza exclusivamente `db_customer`, Prisma 7 con el adaptador PostgreSQL y publica eventos en RabbitMQ mediante una outbox transaccional.

## Funciones iniciales

- Registro de clientes `CLIENT` en estado `INACTIVE` mediante `multipart/form-data`.
- Foto de documento como binario `bytea` en `db_customer`; el perfil solo expone `hasIdentityPhoto`.
- Username único derivado del nombre, fecha de nacimiento coherente y unicidad de documento/correo.
- Inicio de sesión con bcrypt y JWT solo para clientes `ACTIVE`.
- Solicitud del correo de activación en el primer login válido; el token expira en 24 horas y es de un solo uso.
- Consulta, actualización con control optimista de versión y bloqueo administrativo.
- Creación de cajeros activos por administradores y listado de clientes para administradores/cajeros.

## Eventos publicados

`CustomerRegistered`, `ActivationEmailRequested`, `CustomerActivated` y `CustomerBlocked`.

Todos siguen el sobre definido en `Docs/Documentacion.md`, incluyen `correlationId`, se guardan primero en `OutboxEvent` y se publican directamente en `notification_queue`, sin exchange ni colas adicionales. El publicador reintenta a los 5, 15 y 30 segundos; los eventos agotados permanecen sin publicar para diagnóstico y reprocesamiento manual.

## Estructura

```text
src/
  main/                         # Bootstrap y composición de módulos NestJS
  modules/customer/
    application/                # Casos de uso de clientes
    auth/application/           # Casos de uso de autenticación
    presentation/http/          # Controllers y DTOs HTTP
    presentation/security/      # Guard JWT
  infrastructure/
    prisma/                     # Adaptador Prisma 7 para PostgreSQL
    messaging/                  # Adaptador RabbitMQ y publicador outbox
  common/
    application/errors/         # AppError y códigos de error del servicio
    presentation/filters/       # Traducción global de errores a HTTP
```

Los controllers solo manejan HTTP. Los servicios de `application` contienen las reglas de negocio y no lanzan excepciones de NestJS; lanzan `AppError`, que el filtro global transforma en una respuesta consistente con `code`, `details` y `correlationId`.

## Foto de documento

El frontend usa `POST /api/customers` en el API Gateway. El Gateway recibe el archivo completo en el campo `identityPhoto` de `multipart/form-data` y lo reenvía al endpoint interno `POST /customers`; no acepta Base64 ni una URL. El servicio admite JPEG, PNG y WebP de hasta 5 MB, verifica la firma binaria del archivo y almacena sus bytes, tipo MIME y checksum SHA-256 en la base de datos propia del servicio.

Para reemplazarlo se usa `PUT /api/customers/:id/identity-document` en el Gateway, con el mismo campo de archivo y `version` como campo del formulario.

Las demás operaciones entran por el API Gateway y utilizan request/reply asíncrono sobre la cola RabbitMQ `customer_queue`. El `correlationId` se genera exclusivamente en el Gateway.

## Desarrollo local

1. Copiar `.env.example` a `.env` y configurar secretos válidos.
2. Iniciar PostgreSQL y RabbitMQ externos al clúster.
3. Ejecutar `npm install` en la raíz.
4. Ejecutar `npm --workspace @bank-usac/customer-service run prisma:generate`.
5. Ejecutar `npm --workspace @bank-usac/customer-service run prisma:migrate`.
6. Ejecutar `npm --workspace @bank-usac/customer-service run start:dev`.

## Contenedor

La imagen se construye desde la raíz del monorepo:

```bash
docker build -f apps/customer-service/Dockerfile -t bank-usac/customer-service:latest .
```

Al iniciar en producción se aplican las migraciones, se ejecuta el seed idempotente del administrador y luego arranca el servicio.

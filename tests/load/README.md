# Pruebas de carga con k6

El script `transactions.js` ejecuta carga sobre el API Gateway y mide lecturas
de saldo y creación de transferencias.

## Requisitos

- k6 instalado.
- API Gateway accesible.
- Una cuenta de prueba autenticable.
- Para lecturas, `K6_ACCOUNT_ID`.
- Para transferencias, cuentas distintas en `K6_SOURCE_ACCOUNT` y
  `K6_TARGET_ACCOUNT`.
- Saldo suficiente para el monto configurado.

Se puede proporcionar un JWT existente con `K6_TOKEN` o permitir que el script
inicie sesión usando `K6_USERNAME` y `K6_PASSWORD`. Las credenciales no deben
guardarse en el repositorio.

## Ejecución

PowerShell con login automático:

```powershell
$env:BASE_URL="http://localhost:3000"
$env:K6_USERNAME="usuario-de-prueba"
$env:K6_PASSWORD="password-de-prueba"
$env:K6_ACCOUNT_ID="account-id"
$env:K6_SOURCE_ACCOUNT="source-account-id"
$env:K6_TARGET_ACCOUNT="target-account-id"
$env:K6_MODE="all"
k6 run tests/load/transactions.js
```

PowerShell con JWT:

```powershell
$env:BASE_URL="http://<API-GATEWAY>"
$env:K6_TOKEN="<JWT>"
$env:K6_ACCOUNT_ID="account-id"
$env:K6_SOURCE_ACCOUNT="source-account-id"
$env:K6_TARGET_ACCOUNT="target-account-id"
k6 run tests/load/transactions.js
```

Modos disponibles:

```powershell
$env:K6_MODE="read"
k6 run tests/load/transactions.js

$env:K6_MODE="transfer"
k6 run tests/load/transactions.js
```

Parámetros opcionales:

- `K6_READ_USERS`: máximo de usuarios virtuales de lectura, por defecto `10`.
- `K6_TRANSFER_USERS`: máximo de usuarios virtuales de transferencia, por defecto `5`.
- `K6_AMOUNT`: monto de cada transferencia, por defecto `1`.
- `K6_SLEEP`: pausa entre iteraciones, por defecto `1` segundo.

## Resultados

```powershell
New-Item -ItemType Directory -Force results
k6 run --summary-export=results/k6-summary.json tests/load/transactions.js
```

Los umbrales del script corresponden a los SLO documentados:

- Lecturas p95 menor a `500 ms`.
- Creación de operaciones p95 menor a `1 s`.
- Error rate menor a `0.5%`.
- Checks exitosos por encima de `99%`.

Durante la prueba se deben observar Grafana, Prometheus, Tempo, Loki,
Alertmanager, RabbitMQ y los HPA. Para la rúbrica se deben conservar el resumen
de k6, capturas de los dashboards y una traza end-to-end asociada al
`X-Correlation-Id` generado por el script.

## Escenario de timeout de Payment Service

El script `payment-timeout.js` obtiene la configuración actual, fuerza
temporalmente `timeoutRatePercent=100`, genera pagos y restaura la configuración
original en `teardown`.

Requiere un usuario administrador para cambiar la simulación, un usuario cliente,
una cuenta origen y un `serviceId` existente. El script puede iniciar sesión
automáticamente usando credenciales, o recibir JWT existentes.

Usando login automático:

```powershell
$env:BASE_URL="http://<API-GATEWAY>"
$env:ADMIN_USERNAME="<USUARIO-ADMIN>"
$env:ADMIN_PASSWORD="<PASSWORD-ADMIN>"
$env:K6_USERNAME="<USUARIO-CLIENTE>"
$env:K6_PASSWORD="<PASSWORD-CLIENTE>"
$env:K6_SOURCE_ACCOUNT="source-account-id"
$env:K6_SERVICE_ID="service-id"
$env:K6_PAYMENT_USERS="5"
$env:K6_TIMEOUT_MS="3000"
$env:K6_SLEEP="1"

& "C:\Program Files\k6\k6.exe" run tests/load/payment-timeout.js
```

También se pueden proporcionar `ADMIN_TOKEN` y `K6_TOKEN` directamente; en ese
caso no se ejecuta el login correspondiente.

Cada pago usa un `Idempotency-Key` y `X-Correlation-Id` únicos. El timeout se
verifica en las métricas, logs y trazas generados por el flujo asíncrono; la
respuesta HTTP inicial puede ser `2xx` porque el procesamiento continúa en la
Saga después de aceptar el pago.

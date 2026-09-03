# Casos de uso

## Casos de uso de alto nivel

El siguiente diagrama muestra los casos de uso principales de Bank USAC y sus actores.

![Casos de uso de alto nivel](../img/CU1.drawio.png)

| Código | Caso de uso | Servicio responsable | Actores principales |
| --- | --- | --- | --- |
| CDU001 | Gestión de clientes y acceso | Customer Service | Cliente, Cajero/Receptor, Administrador |
| CDU002 | Gestión de cuentas y saldo | Account Service | Cliente, Cajero/Receptor, Administrador |
| CDU003 | Gestión de transferencias | Transaction Service | Cliente, Cajero/Receptor |
| CDU004 | Gestión de pagos | Payment Service | Cliente, Cajero/Receptor |
| CDU005 | Gestión de notificaciones y registros | Notification & Audit Service | Cliente, Administrador |

## Descomposición por servicio

### Customer Service

![Gestión de usuarios](../img/CUANUsuario.drawio.png)

#### CDU001 - Gestión de clientes y acceso

| Campo | Descripción |
| --- | --- |
| **Nombre** | Gestión de clientes y acceso |
| **Código** | CDU001 |
| **Actores** | Cliente, Cajero/Receptor, Administrador |
| **Descripción** | Centraliza el registro, la identificación, las credenciales y el ciclo de vida de los clientes de Bank USAC. Permite registrar clientes y cajeros, iniciar sesión, activar cuentas y actualizar información de perfil. |
| **Precondiciones** | El sistema se encuentra operativo. El cajero/receptor o administrador ha iniciado sesión para realizar operaciones administrativas. El cliente proporciona datos personales y documento de identificación válidos. |
| **Postcondiciones** | El cliente o cajero queda registrado con sus credenciales y estado correspondiente. Cuando la activación es exitosa, el cliente queda habilitado para utilizar la plataforma. |
| **Flujo principal** | Ver diagrama de flujo principal. |
| **Flujos alternos** | Ver diagramas FA1 a FA5. |
| **Reglas de negocio** | RN1: El documento y el correo deben ser únicos.<br>RN2: El username debe ser único.<br>RN3: Solo un usuario activo puede recibir un JWT operativo.<br>RN4: El enlace de activación expira y solo puede utilizarse una vez. |
| **Reglas de calidad** | RC1: El registro debe validar los campos obligatorios antes de persistir la información.<br>RC2: Las credenciales deben protegerse y la autenticación debe emitir JWT solo para usuarios activos.<br>RC3: La activación debe usar un token temporal de un solo uso. |

##### Flujo principal

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente proporciona datos y credenciales]
    B --> C{Datos completos y únicos?}
    C -->|No| D[Informar error de validación]
    D --> Z([Fin])
    C -->|Sí| E[Registrar cliente y generar username]
    E --> F[Cliente inicia sesión]
    F --> G{Cliente activo?}
    G -->|No| H[Solicitar activación]
    H --> I[Activar con token temporal]
    I --> J[Permitir acceso]
    G -->|Sí| J
    J --> Z
```

##### FA1 - Registrar cliente (CDU001.1)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cajero registra datos y documento]
    B --> C{Fecha válida, documento y correo únicos?}
    C -->|No| D[Rechazar registro e informar causa]
    D --> Z([Fin])
    C -->|Sí| E[Crear cliente pendiente de activación]
    E --> Z
```

##### FA2 - Validar identidad (CDU001.2)

```mermaid
flowchart TD
    A([Inicio]) --> B[Verificar documento e información personal]
    B --> C{Información completa y sin duplicados?}
    C -->|No| D[Rechazar registro e informar causa]
    C -->|Sí| E[Validar identidad]
    D --> Z([Fin])
    E --> Z
```

##### FA3 - Registrar cajero/receptor (CDU001.3)

```mermaid
flowchart TD
    A([Inicio]) --> B[Administrador registra datos del operador]
    B --> C[Crear credenciales con rol CASHIER]
    C --> D[Confirmar registro del cajero]
    D --> Z([Fin])
```

##### FA4 - Iniciar sesión y activar cuenta (CDU001.4 y CDU001.5)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente ingresa username y contraseña]
    B --> C{Credenciales válidas?}
    C -->|No| D[Rechazar inicio de sesión]
    D --> Z([Fin])
    C -->|Sí| E{Cliente activo?}
    E -->|Sí| F[Emitir JWT y permitir acceso]
    E -->|No| G[Generar enlace temporal de activación]
    G --> H[Cliente activa la cuenta]
    H --> F
    F --> Z
```

##### FA5 - Editar perfil (CDU001.7)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente solicita actualización de datos]
    B --> C{Nuevos datos válidos?}
    C -->|No| D[Informar error de validación]
    C -->|Sí| E[Actualizar perfil]
    D --> Z([Fin])
    E --> Z
```

![Detalle de gestión de usuarios](../img/CUDUsuario.drawio.png)

### Account Service

![Gestión de cuentas](../img/CUANCuentas.drawio.png)

#### CDU002 - Gestión de cuentas bancarias y saldo

| Campo | Descripción |
| --- | --- |
| **Nombre** | Gestión de cuentas bancarias y saldo |
| **Código** | CDU002 |
| **Actores** | Cliente, Cajero/Receptor, Administrador |
| **Descripción** | Administra las cuentas monetarias y de ahorro, sus saldos, estados, movimientos de débito o crédito y reservas de fondos requeridas por transferencias. |
| **Precondiciones** | El cliente existe y se encuentra habilitado. El actor cuenta con permisos para crear, consultar, bloquear o modificar la cuenta. |
| **Postcondiciones** | La cuenta queda creada, consultada, bloqueada o actualizada según la operación solicitada. Los fondos reservados se mantienen separados del saldo disponible. |
| **Flujo principal** | Ver diagrama de flujo principal. |
| **Flujos alternos** | Ver diagramas FA1 a FA4. |
| **Reglas de negocio** | RN1: Una cuenta pertenece exclusivamente a un cliente.<br>RN2: Una cuenta debe ser monetaria o de ahorro.<br>RN3: Una cuenta `BLOCKED` o `INACTIVE` no puede originar transferencias.<br>RN4: Los fondos reservados no forman parte del saldo disponible.<br>RN5: Una cuenta se desactiva después de seis meses sin actividad y saldo menor a Q50.00. |
| **Reglas de calidad** | RC1: Cada cuenta debe conservar su saldo y estado de forma consistente.<br>RC2: Las operaciones de reserva, crédito y liberación deben poder identificarse para evitar duplicados.<br>RC3: La consulta de saldo solo debe mostrar información de cuentas autorizadas. |

##### Flujo principal

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente o cajero solicita operación de cuenta]
    B --> C{Actor autorizado y cuenta válida?}
    C -->|No| D[Rechazar operación]
    D --> Z([Fin])
    C -->|Sí| E[Consultar o actualizar cuenta y saldo]
    E --> F[Registrar estado actualizado]
    F --> G[Devolver resultado]
    G --> Z
```

##### FA1 - Crear cuenta (CDU002.1)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cajero selecciona cliente existente]
    B --> C[Indicar cuenta monetaria o de ahorro]
    C --> D{Cliente válido?}
    D -->|No| E[Rechazar creación]
    D -->|Sí| F[Crear cuenta asociada a customerId]
    E --> Z([Fin])
    F --> Z
```

##### FA2 - Consultar saldo o cuenta (CDU002.2 y CDU002.3)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente solicita saldo o información]
    B --> C{Cuenta pertenece al cliente?}
    C -->|No| D[Denegar consulta]
    C -->|Sí| E[Obtener saldo disponible e información]
    D --> Z([Fin])
    E --> F[Mostrar resultado]
    F --> Z
```

##### FA3 - Bloquear cuenta (CDU002.4)

```mermaid
flowchart TD
    A([Inicio]) --> B[Administrador solicita bloqueo]
    B --> C{Cuenta existe?}
    C -->|No| D[Informar cuenta no encontrada]
    C -->|Sí| E[Cambiar estado a BLOCKED]
    E --> F[Impedir transferencias desde la cuenta]
    D --> Z([Fin])
    F --> Z
```

##### FA4 - Actualizar saldo y compensar (CDU002.5 y CDU002.6)

```mermaid
flowchart TD
    A([Inicio]) --> B[Recibir solicitud de reserva, crédito o liberación]
    B --> C{Saldo y operación válidos?}
    C -->|No| D[Rechazar operación]
    C -->|Sí| E[Registrar cambio de saldo]
    E --> F{Operación distribuida falló?}
    F -->|Sí| G[Liberar fondos reservados]
    F -->|No| H[Confirmar resultado]
    D --> Z([Fin])
    G --> Z
    H --> Z
```

![Detalle de gestión de cuentas](../img/CUDCuentas.drawio.png)

### Transaction Service

![Gestión de transacciones](../img/CUANTransaction.drawio.png)

#### CDU003 - Gestión de transferencias monetarias

| Campo | Descripción |
| --- | --- |
| **Nombre** | Gestión de transferencias monetarias entre cuentas |
| **Código** | CDU003 |
| **Actores** | Cliente, Cajero/Receptor |
| **Descripción** | Permite iniciar transferencias entre cuentas, validar la información financiera, mantener el estado de la operación y consultar el historial de transferencias. |
| **Precondiciones** | El cliente se encuentra autenticado y posee una cuenta origen activa. La cuenta origen y destino existen. El monto solicitado es mayor que cero. |
| **Postcondiciones** | La transferencia queda registrada con su estado actual. Si se completa, los fondos quedan acreditados en la cuenta destino; si falla, se liberan los fondos reservados cuando aplica. |
| **Flujo principal** | Ver diagrama de flujo principal. |
| **Flujos alternos** | Ver diagramas FA1 a FA4. |
| **Reglas de negocio** | RN1: La cuenta origen debe pertenecer al cliente autenticado.<br>RN2: No se permite transferir dinero a la misma cuenta.<br>RN3: El monto debe ser mayor que cero.<br>RN4: El saldo disponible debe cubrir el monto solicitado.<br>RN5: Una solicitud repetida no debe crear una nueva transferencia. |
| **Reglas de calidad** | RC1: Los mensajes de una transferencia deben conservar el mismo `correlationId`.<br>RC2: El procesamiento debe evitar operaciones duplicadas.<br>RC3: Ante fallo posterior a una reserva, el sistema debe liberar los fondos reservados. |

##### Flujo principal

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente ingresa cuentas y monto]
    B --> C{Cuentas válidas y saldo suficiente?}
    C -->|No| D[Rechazar transferencia]
    D --> Z([Fin])
    C -->|Sí| E[Registrar transferencia]
    E --> F[Solicitar reserva de fondos]
    F --> G[Solicitar crédito a cuenta destino]
    G --> H[Actualizar estado de transferencia]
    H --> I[Comunicar resultado]
    I --> Z
```

##### FA1 - Iniciar transferencia (CDU003.1)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente envía transferencia con clave de idempotencia]
    B --> C{Solicitud ya procesada?}
    C -->|Sí| D[Devolver resultado anterior]
    C -->|No| E[Registrar como REQUESTED o PENDING]
    D --> Z([Fin])
    E --> F[Iniciar procesamiento]
    F --> Z
```

##### FA2 - Validar información (CDU003.2)

```mermaid
flowchart TD
    A([Inicio]) --> B[Validar cuenta origen, destino y monto]
    B --> C{Cuenta origen pertenece al cliente?}
    C -->|No| D[Rechazar solicitud]
    C -->|Sí| E{Cuentas distintas y monto mayor a cero?}
    E -->|No| D
    E -->|Sí| F{Saldo disponible suficiente?}
    F -->|No| D
    F -->|Sí| G[Validación exitosa]
    D --> Z([Fin])
    G --> Z
```

##### FA3 - Gestionar estado (CDU003.3)

```mermaid
flowchart TD
    A([Inicio]) --> B[Recibir resultado de reserva y crédito]
    B --> C{Crédito a destino exitoso?}
    C -->|Sí| D[Marcar transferencia COMPLETED]
    C -->|No| E[Solicitar liberación de fondos]
    E --> F[Registrar resultado de compensación]
    D --> Z([Fin])
    F --> Z
```

##### FA4 - Consultar transferencias (CDU003.4)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente consulta transferencia o historial]
    B --> C{Transferencia pertenece al cliente?}
    C -->|No| D[Denegar consulta]
    C -->|Sí| E[Obtener transferencias solicitadas]
    D --> Z([Fin])
    E --> F[Mostrar resultado]
    F --> Z
```

![Detalle de transacciones](../img/CUDTransaction.drawio.png)

### Payment Service

![Gestión de pagos](../img/CUANPago.drawio.png)

#### CDU004 - Gestión de pagos

| Campo | Descripción |
| --- | --- |
| **Nombre** | Gestión de pagos |
| **Código** | CDU004 |
| **Actores** | Cliente, Cajero/Receptor |
| **Descripción** | Permite registrar pagos asociados a operaciones, validar su información, procesarlos y consultar su estado o historial. |
| **Precondiciones** | El cliente se encuentra autenticado. La información del pago está completa y la operación relacionada existe cuando aplica. |
| **Postcondiciones** | El pago queda registrado con estado `APPROVED`, `REJECTED` o `FAILED`, según el resultado de su procesamiento. |
| **Flujo principal** | Ver diagrama de flujo principal. |
| **Flujos alternos** | Ver diagramas FA1 a FA4. |
| **Reglas de negocio** | RN1: Un pago debe estar asociado a una operación válida cuando corresponda.<br>RN2: Un mismo pago no debe procesarse dos veces.<br>RN3: Todo rechazo debe conservar su causa.<br>RN4: Solo un pago pendiente puede cancelarse. |
| **Reglas de calidad** | RC1: El estado del pago debe estar disponible para consulta después de su procesamiento.<br>RC2: El procesamiento debe evitar duplicados.<br>RC3: Los resultados aprobados o rechazados deben notificarse al servicio correspondiente. |

##### Flujo principal

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente o cajero inicia pago]
    B --> C{Información completa y válida?}
    C -->|No| D[Rechazar solicitud]
    D --> Z([Fin])
    C -->|Sí| E[Registrar pago]
    E --> F[Procesar pago]
    F --> G[Actualizar estado]
    G --> H[Permitir consulta del resultado]
    H --> Z
```

##### FA1 - Consultar historial de pagos (CDU004.1)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente solicita pago por identificador]
    B --> C{Pago existe y está autorizado?}
    C -->|No| D[Informar pago no disponible]
    C -->|Sí| E[Obtener información del pago]
    D --> Z([Fin])
    E --> F[Mostrar estado e historial]
    F --> Z
```

##### FA2 - Iniciar y validar pago (CDU004.2 y CDU004.3)

```mermaid
flowchart TD
    A([Inicio]) --> B[Actor ingresa información del pago]
    B --> C{Datos completos y válidos?}
    C -->|No| D[Solicitar corrección de datos]
    C -->|Sí| E[Aceptar solicitud de pago]
    D --> Z([Fin])
    E --> Z
```

##### FA3 - Registrar pago (CDU004.4)

```mermaid
flowchart TD
    A([Inicio]) --> B[Crear pago en estado inicial]
    B --> C[Procesar pago]
    C --> D{Pago aprobado?}
    D -->|Sí| E[Registrar estado APPROVED]
    D -->|No| F[Registrar estado REJECTED y causa]
    E --> Z([Fin])
    F --> Z
```

##### FA4 - Cancelar pago (CDU004.5)

```mermaid
flowchart TD
    A([Inicio]) --> B[Cliente solicita cancelación]
    B --> C{Pago pendiente?}
    C -->|No| D[Rechazar cancelación]
    C -->|Sí| E[Registrar cancelación]
    D --> Z([Fin])
    E --> Z
```

![Detalle de pagos](../img/CUDPagos.draw.png)

### Notification & Audit Service

![Gestión de notificaciones](../img/CUANNotif.drawio.png)

#### CDU005 - Gestión de notificaciones y registros internos



![Detalle de notificaciones](../img/CUDNoti.drawio.png)
| Campo | Descripción |
| --- | --- |
| **Nombre** | Gestión de notificaciones y registros internos |
| **Código** | CDU005 |
| **Actores** | Cliente, Administrador |
| **Descripción** | Recibe eventos generados por los demás servicios para enviar notificaciones de activación, transferencias y pagos, además de conservar registros internos de las operaciones procesadas. |
| **Precondiciones** | Los servicios productores han publicado un evento con su información de correlación. El cliente cuenta con un correo registrado cuando la operación requiere notificación. |
| **Postcondiciones** | El evento queda registrado para consulta interna y el cliente recibe la notificación correspondiente cuando aplica. |
| **Flujo principal** | Ver diagrama de flujo principal. |
| **Flujos alternos** | Ver diagramas FA1 a FA3. |
| **Reglas de negocio** | RN1: Los eventos de una misma operación deben conservar el mismo `correlationId`.<br>RN2: Un fallo de notificación no revierte una transferencia o pago completado.<br>RN3: Un evento repetido no debe duplicar el registro interno. |
| **Reglas de calidad** | RC1: El procesamiento debe conservar la información necesaria para rastrear la operación.<br>RC2: Las notificaciones fallidas deben poder identificarse para su seguimiento.<br>RC3: El servicio debe procesar los eventos sin bloquear la operación bancaria original. |

##### Flujo principal

```mermaid
flowchart TD
    A([Inicio]) --> B[Servicio publica evento relevante]
    B --> C[Recibir y procesar evento]
    C --> D[Conservar información de la operación]
    D --> E{Evento requiere notificación?}
    E -->|Sí| F[Generar notificación al cliente]
    E -->|No| Z([Fin])
    F --> Z
```

##### FA1 - Enviar correo de activación (CDU005.1)

```mermaid
flowchart TD
    A([Inicio]) --> B[Recibir ActivationEmailRequested]
    B --> C{Cliente tiene correo registrado?}
    C -->|No| D[Registrar imposibilidad de notificar]
    C -->|Sí| E[Preparar notificación de activación]
    E --> F[Enviar correo]
    D --> Z([Fin])
    F --> Z
```

##### FA2 - Notificar operaciones (CDU005.2)

```mermaid
flowchart TD
    A([Inicio]) --> B[Recibir resultado de transferencia o pago]
    B --> C{Resultado requiere aviso al cliente?}
    C -->|No| D[Finalizar procesamiento]
    C -->|Sí| E[Preparar notificación de resultado]
    E --> F[Enviar notificación al cliente]
    D --> Z([Fin])
    F --> Z
```

##### FA3 - Registrar información interna (CDU005.3)

```mermaid
flowchart TD
    A([Inicio]) --> B[Recibir evento]
    B --> C[Conservar tipo, fecha, payload y correlationId]
    C --> D[Administrador consulta registros cuando es necesario]
    D --> Z([Fin])
```
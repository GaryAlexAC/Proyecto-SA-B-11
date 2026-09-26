# Manual de Usuario — Bank USAC

## Introducción

Bank USAC es un sistema bancario distribuido basado en microservicios. Este manual describe cómo utilizar el sistema según el rol asignado.

Existen **3 roles** en el sistema:
- **Administrador:** Gestión total de clientes y cuentas.
- **Cajero/Receptor:** Registro de clientes, creación de cuentas y operaciones financieras.
- **Cliente:** Consulta de saldo, transferencias y pagos propios.

---

## Acceso al Sistema

### Iniciar Sesión
1. Ingresa desde tu navegador a la IP o dominio público asignado al frontend por Azure Load Balancer. El equipo de operación puede consultarlo con `kubectl get svc frontend -n dev`.
2. En la pantalla de **Login**, ingresa tu **usuario** y **contraseña**.
3. Haz clic en **Iniciar sesión**.

> **Nota:** Si tu cuenta está **inactiva**, el sistema te enviará automáticamente un correo de activación. Debes hacer clic en el enlace recibido antes de poder ingresar.

### Activar Cuenta (primer ingreso)
1. Revisa tu correo electrónico registrado.
2. Haz clic en el enlace de activación (válido por 24 horas).
3. El sistema cambiará tu estado a **Activo** y podrás iniciar sesión normalmente.

---

## Funcionalidades por Rol

### 👤 Cliente

#### Consultar Saldo
1. En el menú lateral, selecciona **Cuentas**.
2. Verás la lista de tus cuentas (monetaria o de ahorro) con su saldo actual.
3. Haz clic en una cuenta para ver el detalle.

#### Realizar una Transferencia
1. En el menú, selecciona **Transferencias**.
2. Haz clic en **Nueva transferencia**.
3. Ingresa:
   - **Cuenta origen** (tu cuenta)
   - **Cuenta destino** (ID de cuenta del destinatario)
   - **Monto** a transferir
4. Confirma la operación.
5. El sistema procesará la transferencia de forma asíncrona. Puedes verificar el estado (PENDING → COMPLETED o FAILED) en la lista de transferencias.

#### Realizar un Pago
1. Selecciona **Pagos** en el menú.
2. Haz clic en **Nuevo pago**.
3. Ingresa los datos requeridos y confirma.

#### Ver mi Perfil
1. Selecciona **Perfil** en el menú.
2. Puedes actualizar tu dirección y datos de contacto.

---

### 🏧 Cajero/Receptor

El cajero tiene todas las funcionalidades del cliente, más:

#### Registrar un Nuevo Cliente
1. Selecciona **Clientes** en el menú.
2. Haz clic en **Registrar cliente**.
3. Completa el formulario con los datos del cliente:
   - Nombre completo, documento, correo, fecha de nacimiento, dirección
   - Sube la **foto del documento de identificación**
4. El sistema genera automáticamente un **username** para el cliente.
5. El cliente recibirá un correo de activación.

#### Crear una Cuenta Bancaria
1. Selecciona **Cuentas** → **Nueva cuenta**.
2. Selecciona el **cliente** y el **tipo de cuenta** (Monetaria o Ahorro).
3. Confirma la creación.

---

### 🔑 Administrador

El administrador tiene todas las funcionalidades del cajero, más:

#### Registrar un Cajero/Receptor
1. Selecciona **Clientes** → **Registrar cajero**.
2. Completa los datos del cajero.

#### Bloquear un Usuario
1. En la lista de **Clientes**, selecciona el usuario.
2. Haz clic en **Bloquear**.
3. El usuario no podrá iniciar sesión mientras esté bloqueado.

---

## Reglas de Negocio Importantes

| Regla | Descripción |
| --- | --- |
| Activación obligatoria | Los usuarios deben activar su cuenta antes de operar |
| Fondos suficientes | No se pueden realizar transferencias sin saldo suficiente |
| Cuentas activas | Solo cuentas activas pueden enviar o recibir transferencias |
| Desactivación automática | Las cuentas con saldo < Q50.00 y sin movimientos por 6 meses se desactivan automáticamente |
| Idempotencia | Las operaciones repetidas con la misma clave de idempotencia no generan duplicados |

---

## Solución de Problemas Frecuentes

| Problema | Solución |
| --- | --- |
| No puedo iniciar sesión | Verifica que tu cuenta esté activa. Si acabas de registrarte, revisa tu correo |
| Transferencia en estado PENDING | El sistema procesa las transferencias de forma asíncrona. Espera unos segundos y recarga |
| Transferencia FAILED | Verifica que tengas fondos suficientes y que la cuenta destino esté activa |
| Token de activación expirado | Intenta iniciar sesión nuevamente para que el sistema envíe un nuevo enlace |

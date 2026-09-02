# Frontend Bank USAC

Aplicación React + TypeScript que consume exclusivamente el API Gateway. En desarrollo, Vite redirige `/api` hacia `http://localhost:3000`.

## Ejecución

```bash
npm install
npm run dev:frontend
```

El frontend queda disponible en `http://localhost:5173`. Si el Gateway usa otro origen, configure `VITE_API_URL` a partir de `.env.example`.

## Funciones por rol

### ADMIN

- Consultar y buscar clientes.
- Consultar expedientes y reemplazar fotografías de documentos.
- Bloquear clientes.
- Crear cajeros activos.
- Crear y consultar cuentas para un cliente.
- Consultar y actualizar su propio perfil.

### CASHIER

- Registrar clientes inactivos con fotografía del documento.
- Consultar y buscar clientes.
- Reemplazar fotografías de documentos.
- Crear y consultar cuentas para un cliente.
- Consultar y actualizar su propio perfil.

### CLIENT

- Consultar y actualizar su perfil.
- Consultar cuentas y saldos.
- Crear y consultar transferencias.
- Crear y consultar pagos.

La navegación oculta las operaciones no autorizadas, pero la autorización definitiva corresponde a cada microservicio mediante el JWT propagado por el API Gateway.

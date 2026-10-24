# Acuerdo de Integración Interbancaria (Proyecto 3)

**Asignatura:** Software Avanzado (2S2026) — Facultad de Ingeniería, USAC  
**Pareja Asignada:** Grupo 11 (**Bank USAC**) & Grupo 6  
**Fecha:** Octubre 2026  
**Contrato Base:** OpenAPI 3.0.3 ([openapi.yaml](../../openapi.yaml))

---

## 1. Identificación de los Bancos

| Parámetro | Banco A (Nosotros) | Banco B (Pareja Asignada) |
| :--- | :--- | :--- |
| **Nombre de la Entidad** | Bank USAC | Banco Grupo 6 |
| **Código de Banco (`BankCode`)** | `BANK11` | `BANK06` |
| **Grupo de Clase** | Grupo 11 | Grupo 6 |
| **Moneda Operativa** | Quetzales (`GTQ`) | Quetzales (`GTQ`) |

---

## 2. Puntos de Entrada y URLs Públicas (`/interbank/v1`)

| Rol | Endpoint / URL Base | Descripción |
| :--- | :--- | :--- |
| **Bank USAC (`BANK11`)** | `http://34.29.251.106/interbank/v1` | Expuesto a través de Google Cloud Load Balancer / Nginx |
| **Banco Pareja (`BANK06`)** | `http://100.52.78.200:30080/interbank/v1` | Endpoint receptor y callback del Grupo 6 (Verificado: `GET /health` responde `{"status":"UP","bankCode":"BANK06"}`) |

---

## 3. Mecanismo de Autenticación y Seguridad

- **Header de Autenticación:** `X-Api-Key` obligatorio en todas las solicitudes (excepto `GET /health`).
- **Clave acordada para `BANK11` (nosotros):**  
  `bank11-partner-key-2026`
- **Clave entregada por el Grupo 6 para que `BANK11` los invoque:**  
  `bank06-partner-key-2026`
- **Trazabilidad W3C:** Ambas entidades propagan el header `traceparent` para correlación distribuida de OpenTelemetry entre bancos.

---

## 4. Cuentas de Prueba para Transferencias

### Cuentas en Bank USAC (`BANK11`)
Estas cuentas están activas y verificadas (KYC) para recibir depósitos desde `BANK06`:

| No. Cuenta | Titular | Tipo | Saldo Inicial |
| :--- | :--- | :--- | :--- |
| `acc-bank11-client1` | Cliente Pruebas A | Monetaria | Q 5,000.00 |
| `acc-bank11-client2` | Cliente Pruebas B | Ahorro | Q 3,000.00 |

### Cuentas en Banco Pareja (`BANK06`)
*Cuentas oficiales entregadas por el Grupo 6 para enviarles depósitos desde Bank USAC:*

| No. Cuenta | Banco | Tipo | Estado |
| :--- | :--- | :--- | :--- |
| `acc-21cf4149` | BANK06 | Monetaria / Principal | Activa y verificada |
| `acc-43fcfaa6` | BANK06 | Ahorro / Secundaria | Activa y verificada |

---

## 5. Reglas de Operación y Tiempos

1. **Tiempo de Expiración (`expiresAt`):**  
   `expiresAt = createdAt + 180 segundos`.  
   Si una transferencia llega vencida, se responderá `422 Unprocessable Entity` con `reasonCode: EXPIRED`.
2. **Límites de Monto:**  
   Monto mínimo: `Q 0.01` — Monto máximo: `Q 10,000.00`.  
   Transferencias mayores responderán `REJECTED` con `AMOUNT_LIMIT_EXCEEDED`.
3. **Idempotencia:**  
   `Idempotency-Key` en el header debe coincidir con `interbankTransferId`. Reintentos idénticos devuelven el estado actual sin duplicar efectos en cuentas.
4. **Protocolo de Fallos y Compensación:**  
   Si `BANK06` responde `REJECTED` o expira el tiempo sin callback, `BANK11` compensa la Saga y libera los fondos retenidos al cliente emisor.

---

## 6. Ventana de Pruebas Conjuntas y Contingencia

- **Ventana de Pruebas Conjuntas:**  
  Sesión en vivo de 2 horas acordada entre ambos equipos previo a la calificación.
- **Contingencia (Simulador Mock):**  
  Bank USAC implementa un simulador Mock interno para `BANK06`. En caso de intermitencias o ausencia de la infraestructura de la contraparte el día de la calificación, la evaluación se ejecutará de forma autónoma contra el simulador mock conforme a lo establecido en la rúbrica oficial.

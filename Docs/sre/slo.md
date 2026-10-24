# Service Level Objectives

| SLI | SLO |
| --- | ---: |
| Disponibilidad del API | >= 99.999 % mensual |
| Tasa de errores 5xx del API | <= 0.5 % mensual |
| Requests de lectura P95 | < 500 ms |
| Creación de operación P95 | < 1 s |
| Operaciones financieras sin error técnico | >= 99 % |
| Eventos procesados antes de 5 s | >= 99 % |
| Eventos agotados del outbox (DLQ lógica) | < 0.5 % |
| Notificaciones procesadas antes de 30 s | >= 95 % |

Los estados terminales del dominio se documentan como `APPROVED` en la
implementación actual. El objetivo de transferencias correctamente procesadas
se calcula usando ese estado, equivalente al estado final exitoso definido por
el enunciado.

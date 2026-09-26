# Diagrama de secuencia - Transferencia

![Secuencia de transferencia exitosa](../img/SecuensTransfer.png)

Transaction Service coordina la transferencia mediante una Saga: reserva fondos, acredita la cuenta destino y confirma el débito. Cada mensaje conserva el mismo `correlationId`.

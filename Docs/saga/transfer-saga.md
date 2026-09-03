# Saga de transferencia implementada

Transaction Service coordina parcialmente la transferencia mediante `correlationId`.

1. Registra la transferencia y publica `TransferRequested`.
2. Envía `ReserveFunds` a Account Service.
3. Account Service responde `FundsReserved` o `FundsReservationRejected`.
4. Al recibir `FundsReserved`, Transaction Service envía `CreditDestination`.
5. Account Service responde `DestinationCredited` o `DestinationCreditRejected`.
6. Al recibir `DestinationCredited`, Transaction Service marca la transferencia como `COMPLETED`.
7. Al recibir `DestinationCreditRejected`, Transaction Service envía `ReleaseFunds`; Account Service responde `FundsReleased`.

La idempotencia de eventos de Account Service se implementa en Transaction Service mediante la tabla `ProcessedEvent`.


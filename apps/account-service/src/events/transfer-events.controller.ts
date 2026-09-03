import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientProxy } from '@nestjs/microservices';
import { AccountsService } from '../accounts/accounts.service.js';

@Controller()
export class TransferEventsController {
  private readonly logger = new Logger(TransferEventsController.name);

  constructor(
    private readonly accountsService: AccountsService,
    @Inject('TRANSACTION_SERVICE')
    private readonly transactionClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  @EventPattern('ReserveFunds')
  async handleReserveFunds(@Payload() data: any) {
    this.logger.log(
      `ReserveFunds command received: correlationId=${data.correlationId}`,
    );

    const { sourceAccountId, targetAccountId, amount, correlationId, eventId } = data;

    try {
      // Paso 1: Intentar reservar fondos (Débito)
      const result = await this.accountsService.reserveFunds(
        sourceAccountId,
        targetAccountId,
        amount,
        correlationId,
        eventId,
      );

      if (result === null) {
        this.logger.log(`Event ${eventId} was already processed, skipping.`);
        return;
      }

      this.logger.log(`Funds reserved successfully for correlationId=${correlationId}`);

      // Emitir Evento a Transaction Service
      this.transactionClient.emit('FundsReserved', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
      });

    } catch (error: any) {
      this.logger.error(`Failed to reserve funds: ${error.message} [corr: ${correlationId}]`);
      
      this.transactionClient.emit('FundsReservationRejected', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
        reason: error.message,
      });
    }
  }

  @EventPattern('CreditDestination')
  async handleCreditDestination(@Payload() data: any) {
    this.logger.log(`CreditDestination command received: correlationId=${data.correlationId}`);

    const { sourceAccountId, targetAccountId, amount, correlationId, eventId } = data;

    try {
      // Paso 2: Intentar abonar fondos (Crédito)
      const result = await this.accountsService.applyCredit(
        sourceAccountId,
        targetAccountId,
        amount,
        correlationId,
        eventId,
      );

      if (result === null) {
        this.logger.log(`Event ${eventId} was already processed, skipping.`);
        return;
      }

      this.logger.log(`Credit applied successfully for correlationId=${correlationId}`);

      this.transactionClient.emit('DestinationCredited', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
      });

    } catch (error: any) {
      this.logger.error(`Failed to apply credit: ${error.message} [corr: ${correlationId}]`);
      
      this.transactionClient.emit('DestinationCreditRejected', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
        reason: error.message,
      });
    }
  }

  @EventPattern('ReleaseFunds')
  async handleReleaseFunds(@Payload() data: any) {
    this.logger.log(`ReleaseFunds command received - Executing COMPENSATING TRANSACTION (Rollback) for correlationId=${data.correlationId}`);

    const { sourceAccountId, targetAccountId, amount, correlationId, eventId, reason } = data;

    try {
      // Paso 3 (Compensación): Reembolsar fondos al origen
      const result = await this.accountsService.refundFunds(
        sourceAccountId,
        amount,
        correlationId,
        eventId,
      );

      if (result === null) {
        this.logger.log(`Event ${eventId} was already processed, skipping.`);
        return;
      }

      this.logger.log(`Rollback completed successfully for correlationId=${correlationId}`);

      this.transactionClient.emit('FundsReleased', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
        reason,
      });

    } catch (error: any) {
      this.logger.error(`CRITICAL: Failed to execute rollback: ${error.message} [corr: ${correlationId}]`);
      // En un sistema real, aquí entraría un proceso manual de reconciliación.
    }
  }
}

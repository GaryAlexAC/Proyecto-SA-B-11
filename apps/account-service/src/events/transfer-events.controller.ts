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
    @Inject('ACCOUNT_SERVICE')
    private readonly accountClient: ClientProxy,
  ) {}

  @EventPattern('TransferRequested')
  async handleTransferRequested(@Payload() data: any) {
    this.logger.log(
      `TransferRequested received: correlationId=${data.correlationId}`,
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

      // Emitimos evento para pasar al Paso 2
      this.accountClient.emit('FundsReserved', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
      });

    } catch (error: any) {
      this.logger.error(`Failed to reserve funds: ${error.message} [corr: ${correlationId}]`);
      
      const failedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'TransferFailed',
        correlationId,
        producer: 'account-service',
        payload: { reason: error.message, sourceAccountId, targetAccountId, amount },
      };

      this.transactionClient.emit('TransferFailed', failedEvent);
      this.notificationClient.emit('TransferFailed', failedEvent);
    }
  }

  @EventPattern('FundsReserved')
  async handleFundsReserved(@Payload() data: any) {
    this.logger.log(`FundsReserved received: correlationId=${data.correlationId}`);

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

      // Transacción finalizada exitosamente
      const completedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'TransferCompleted',
        correlationId,
        producer: 'account-service',
        payload: { sourceAccountId, targetAccountId, amount, status: 'COMPLETED' },
      };

      this.transactionClient.emit('TransferCompleted', completedEvent);
      this.notificationClient.emit('TransferCompleted', completedEvent);

    } catch (error: any) {
      this.logger.error(`Failed to apply credit: ${error.message} [corr: ${correlationId}]`);
      
      // Emitimos evento de fallo para disparar la Compensación (Rollback)
      this.accountClient.emit('CreditFailed', {
        eventId: crypto.randomUUID(),
        correlationId,
        sourceAccountId,
        targetAccountId,
        amount,
        reason: error.message,
      });
    }
  }

  @EventPattern('CreditFailed')
  async handleCreditFailed(@Payload() data: any) {
    this.logger.log(`CreditFailed received - Executing COMPENSATING TRANSACTION (Rollback) for correlationId=${data.correlationId}`);

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

      // Notificar al mundo que la transferencia falló
      const failedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'TransferFailed',
        correlationId,
        producer: 'account-service',
        payload: { reason, sourceAccountId, targetAccountId, amount },
      };

      this.transactionClient.emit('TransferFailed', failedEvent);
      this.notificationClient.emit('TransferFailed', failedEvent);

    } catch (error: any) {
      this.logger.error(`CRITICAL: Failed to execute rollback: ${error.message} [corr: ${correlationId}]`);
      // En un sistema real, aquí entraría un proceso manual de reconciliación.
    }
  }
}

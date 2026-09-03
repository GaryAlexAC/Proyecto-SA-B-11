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

  @EventPattern('TransferRequested')
  async handleTransferRequested(@Payload() data: any) {
    this.logger.log(
      `TransferRequested received: correlationId=${data.correlationId}`,
    );

    // FIX BUG #2: fields are now at root level (fixed in transaction-service)
    const { sourceAccountId, targetAccountId, amount, correlationId, eventId } =
      data;

    try {
      // FIX BUG #3: single atomic operation — validates both accounts, then debits + credits
      // Returns null if event was already processed (idempotent)
      const result = await this.accountsService.transferFunds(
        sourceAccountId,
        targetAccountId,
        amount,
        correlationId,
        eventId,
      );

      if (result === null) {
        // Already processed — safe to ack without re-emitting
        this.logger.log(`Event ${eventId} was already processed, skipping.`);
        return;
      }

      this.logger.log(
        `Transfer executed successfully for correlationId=${correlationId}`,
      );

      // Complete Saga — notify both Transaction Service (state update) and Notification Service (audit + email)
      const completedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'TransferCompleted',
        correlationId,
        producer: 'account-service',
        payload: {
          sourceAccountId,
          targetAccountId,
          amount,
          status: 'COMPLETED',
        },
      };

      this.transactionClient.emit('TransferCompleted', completedEvent);
      this.notificationClient.emit('TransferCompleted', completedEvent);
    } catch (error: any) {
      this.logger.error(
        `Failed to process transfer: ${error.message} [corr: ${correlationId}]`,
      );

      const failedEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'TransferFailed',
        correlationId,
        producer: 'account-service',
        payload: {
          reason: error.message,
          sourceAccountId,
          targetAccountId,
          amount,
        },
      };

      this.transactionClient.emit('TransferFailed', failedEvent);
      this.notificationClient.emit('TransferFailed', failedEvent);
    }
  }
}

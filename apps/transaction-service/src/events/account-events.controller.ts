import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, Payload, ClientProxy } from '@nestjs/microservices';
import { TransactionsService } from '../transactions/transactions.service.js';
import { TransactionStatus } from '@prisma/client-transaction';

@Controller()
export class AccountEventsController {
  private readonly logger = new Logger(AccountEventsController.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    @Inject('ACCOUNT_SERVICE') private readonly accountClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  @EventPattern('FundsReserved')
  async handleFundsReserved(@Payload() data: any) {
    this.logger.log(`FundsReserved received for correlationId: ${data.correlationId}`);
    
    // Marcar como PROCESSING
    await this.transactionsService.updateTransactionStatus(
      data.correlationId,
      TransactionStatus.PROCESSING,
      data.eventId,
    );

    // Enviar Comando CreditDestination al Account Service
    this.accountClient.emit('CreditDestination', {
      eventId: crypto.randomUUID(),
      eventType: 'CreditDestination',
      correlationId: data.correlationId,
      sourceAccountId: data.sourceAccountId,
      targetAccountId: data.targetAccountId,
      amount: data.amount,
    });
  }

  @EventPattern('FundsReservationRejected')
  async handleFundsReservationRejected(@Payload() data: any) {
    this.logger.log(`FundsReservationRejected received for correlationId: ${data.correlationId}`);
    
    await this.transactionsService.failTransaction(
      data.correlationId,
      data.reason || 'Insufficient funds or account inactive',
      data.eventId,
    );

    this.notificationClient.emit('TransferFailed', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferFailed',
      correlationId: data.correlationId,
      payload: { reason: data.reason },
    });
  }

  @EventPattern('DestinationCredited')
  async handleDestinationCredited(@Payload() data: any) {
    this.logger.log(`DestinationCredited received for correlationId: ${data.correlationId}`);
    
    await this.transactionsService.completeTransaction(
      data.correlationId,
      data.eventId,
    );

    this.notificationClient.emit('TransferCompleted', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferCompleted',
      correlationId: data.correlationId,
      payload: {
        sourceAccountId: data.sourceAccountId,
        targetAccountId: data.targetAccountId,
        amount: data.amount,
        status: 'COMPLETED',
      },
    });

    this.paymentClient.emit('TransferCompleted', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferCompleted',
      correlationId: data.correlationId,
      transactionId: data.correlationId,
      amount: data.amount,
      type: 'INTERNAL',
      description: 'Transferencia completada por la saga',
    });
  }

  @EventPattern('DestinationCreditRejected')
  async handleDestinationCreditRejected(@Payload() data: any) {
    this.logger.log(`DestinationCreditRejected received for correlationId: ${data.correlationId}. Executing COMPENSATING TRANSACTION.`);
    
    // Marcar como COMPENSATING
    await this.transactionsService.updateTransactionStatus(
      data.correlationId,
      TransactionStatus.COMPENSATING,
      data.eventId,
    );

    // Enviar Comando ReleaseFunds al Account Service (Rollback)
    this.accountClient.emit('ReleaseFunds', {
      eventId: crypto.randomUUID(),
      eventType: 'ReleaseFunds',
      correlationId: data.correlationId,
      sourceAccountId: data.sourceAccountId,
      amount: data.amount,
      reason: data.reason,
    });
  }

  @EventPattern('FundsReleased')
  async handleFundsReleased(@Payload() data: any) {
    this.logger.log(`FundsReleased (Rollback completed) received for correlationId: ${data.correlationId}`);
    
    await this.transactionsService.failTransaction(
      data.correlationId,
      data.reason || 'Rollback applied',
      data.eventId,
    );

    this.notificationClient.emit('TransferFailed', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferFailed',
      correlationId: data.correlationId,
      payload: { reason: data.reason },
    });
  }
}

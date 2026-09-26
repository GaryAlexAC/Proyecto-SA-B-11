import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TransactionStatus } from '@prisma/client-transaction';
import { MessagingService } from '../messaging/messaging.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';

function flatten(data: any): any {
  if (data && typeof data.payload === 'object' && data.payload !== null) {
    return { ...data, ...data.payload };
  }
  return data;
}

@Controller()
export class AccountEventsController {
  private readonly logger = new Logger(AccountEventsController.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly messaging: MessagingService,
  ) {}

  @EventPattern('FundsReserved')
  async handleFundsReserved(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `FundsReserved received for correlationId: ${data.correlationId}`,
    );

    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (!transaction) return;

    if (transaction.companyId) {
      const completed = await this.transactionsService.completeTransaction(
        data.correlationId,
        data.eventId,
        [
          {
            id: `${data.correlationId}:transfer-completed`,
            eventType: 'TransferCompleted',
            correlationId: data.correlationId,
            causationId: data.eventId,
            payload: {
              transactionId: transaction.id,
              customerId: transaction.customerId,
              sourceAccountId: transaction.sourceAccountId,
              amount: Number(transaction.amount),
              status: 'APPROVED',
            },
          },
          {
            id: `${data.correlationId}:payment-transaction-completed`,
            eventType: 'PaymentTransactionCompleted',
            correlationId: data.correlationId,
            causationId: data.eventId,
            payload: {},
          },
        ],
      );
      if (completed) void this.messaging.flush();
      return;
    }

    const processing = await this.transactionsService.updateTransactionStatus(
      data.correlationId,
      TransactionStatus.PROCESSING,
      data.eventId,
      [TransactionStatus.PENDING],
      [
        {
          id: `${data.correlationId}:credit-destination`,
          eventType: 'CreditDestination',
          correlationId: data.correlationId,
          causationId: data.eventId,
          payload: {
            sourceAccountId: transaction.sourceAccountId,
            targetAccountId: data.targetAccountId ?? transaction.targetAccountId,
            amount: Number(transaction.amount),
          },
        },
      ],
    );
    if (processing) void this.messaging.flush();
  }

  @EventPattern('FundsReservationRejected')
  async handleFundsReservationRejected(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `FundsReservationRejected received for correlationId: ${data.correlationId}`,
    );
    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (!transaction) return;

    const reason = data.reason || 'Insufficient funds or account inactive';
    const failed = await this.transactionsService.failTransaction(
      data.correlationId,
      reason,
      data.eventId,
      [TransactionStatus.PENDING],
      this.failedEvents(transaction, data, reason, 'reservation'),
    );
    if (failed) void this.messaging.flush();
  }

  @EventPattern('DestinationCredited')
  async handleDestinationCredited(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `DestinationCredited received for correlationId: ${data.correlationId}`,
    );
    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (!transaction) return;

    const completed = await this.transactionsService.completeTransaction(
      data.correlationId,
      data.eventId,
      [
        {
          id: `${data.correlationId}:transfer-completed`,
          eventType: 'TransferCompleted',
          correlationId: data.correlationId,
          causationId: data.eventId,
          payload: {
            transactionId: transaction.id,
            customerId: transaction.customerId,
            sourceAccountId: transaction.sourceAccountId,
            targetAccountId: transaction.targetAccountId,
            amount: Number(transaction.amount),
            status: 'APPROVED',
          },
        },
      ],
    );
    if (completed) void this.messaging.flush();
  }

  @EventPattern('DestinationCreditRejected')
  async handleDestinationCreditRejected(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `DestinationCreditRejected received for correlationId: ${data.correlationId}`,
    );
    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (!transaction) return;

    const compensating =
      await this.transactionsService.updateTransactionStatus(
        data.correlationId,
        TransactionStatus.COMPENSATING,
        data.eventId,
        [TransactionStatus.PROCESSING],
        [
          {
            id: `${data.correlationId}:release-funds`,
            eventType: 'ReleaseFunds',
            correlationId: data.correlationId,
            causationId: data.eventId,
            payload: {
              sourceAccountId: transaction.sourceAccountId,
              targetAccountId: transaction.targetAccountId,
              amount: Number(transaction.amount),
              reason: data.reason,
            },
          },
        ],
      );
    if (compensating) void this.messaging.flush();
  }

  @EventPattern('FundsReleased')
  async handleFundsReleased(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `FundsReleased received for correlationId: ${data.correlationId}`,
    );
    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (!transaction) return;

    const reason = data.reason || 'Rollback applied';
    const failed = await this.transactionsService.failTransaction(
      data.correlationId,
      reason,
      data.eventId,
      [TransactionStatus.COMPENSATING],
      this.failedEvents(transaction, data, reason, 'compensation'),
    );
    if (failed) void this.messaging.flush();
  }

  private failedEvents(
    transaction: { id: string; customerId: string; amount: unknown; companyId: string | null },
    data: any,
    reason: string,
    slug: string,
  ) {
    const events: Array<{
      id: string;
      eventType: 'TransferFailed' | 'PaymentTransactionFailed';
      correlationId: string;
      causationId?: string;
      payload: Record<string, unknown>;
    }> = [
      {
        id: `${data.correlationId}:transfer-failed-${slug}`,
        eventType: 'TransferFailed',
        correlationId: data.correlationId,
        causationId: data.eventId,
        payload: {
          transactionId: transaction.id,
          customerId: transaction.customerId,
          amount: Number(transaction.amount),
          reason,
          stage: slug.toUpperCase(),
        },
      },
    ];
    if (transaction.companyId) {
      events.push({
        id: `${data.correlationId}:payment-transaction-failed-${slug}`,
        eventType: 'PaymentTransactionFailed',
        correlationId: data.correlationId,
        causationId: data.eventId,
        payload: { reason },
      });
    }
    return events;
  }
}
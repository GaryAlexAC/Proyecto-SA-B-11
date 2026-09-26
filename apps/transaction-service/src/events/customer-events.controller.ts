import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MessagingService } from '../messaging/messaging.service.js';
import { TransactionsService } from '../transactions/transactions.service.js';

interface KycResultEvent {
  eventId: string;
  correlationId: string;
  payload: {
    transactionId: string;
    customerId: string;
    kycStatus: string;
    reason?: string;
  };
}

@Controller()
export class CustomerEventsController {
  private readonly logger = new Logger(CustomerEventsController.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly messaging: MessagingService,
  ) {}

  @EventPattern('KycValidationApproved')
  async handleApproved(@Payload() data: KycResultEvent) {
    const transaction = await this.validTransaction(data);
    if (!transaction) return;
    if (data.payload?.kycStatus !== 'VERIFIED') {
      this.logger.error(
        `Evento KycValidationApproved sin estado VERIFIED para ${data.correlationId}`,
      );
      return;
    }

    const updated = await this.transactionsService.approveKyc(
      data.correlationId,
      data.eventId,
      [
        {
          id: `${data.correlationId}:reserve-funds`,
          eventType: 'ReserveFunds',
          correlationId: data.correlationId,
          causationId: data.eventId,
          payload: {
            customerId: transaction.customerId,
            initiatedBy: transaction.initiatedBy,
            initiatorRole: transaction.initiatorRole,
            sourceAccountId: transaction.sourceAccountId,
            targetAccountId: transaction.targetAccountId,
            amount: Number(transaction.amount),
          },
        },
      ],
    );
    if (updated) void this.messaging.flush();
  }

  @EventPattern('KycValidationRejected')
  async handleRejected(@Payload() data: KycResultEvent) {
    const transaction = await this.validTransaction(data);
    if (!transaction) return;

    const reason = data.payload?.reason || 'KYC_NOT_VERIFIED';
    const failed = await this.transactionsService.rejectKyc(
      data.correlationId,
      reason,
      data.eventId,
      [
        {
          id: `${data.correlationId}:transfer-failed-kyc`,
          eventType: 'TransferFailed',
          correlationId: data.correlationId,
          causationId: data.eventId,
          payload: {
            transactionId: transaction.id,
            customerId: transaction.customerId,
            amount: Number(transaction.amount),
            reason,
            stage: 'KYC_VALIDATION',
          },
        },
        ...(transaction.companyId
          ? [
              {
                id: `${data.correlationId}:payment-transaction-failed-kyc`,
                eventType: 'PaymentTransactionFailed' as const,
                correlationId: data.correlationId,
                causationId: data.eventId,
                payload: { reason },
              },
            ]
          : []),
      ],
    );
    if (failed) void this.messaging.flush();
  }

  private async validTransaction(data: KycResultEvent) {
    const transaction =
      await this.transactionsService.getTransactionByCorrelation(
        data.correlationId,
      );
    if (
      !transaction ||
      !data.payload ||
      transaction.id !== data.payload.transactionId ||
      transaction.customerId !== data.payload.customerId
    ) {
      this.logger.error(
        `Resultado KYC no coincide con la transacción ${data.correlationId}`,
      );
      return null;
    }
    return transaction;
  }
}
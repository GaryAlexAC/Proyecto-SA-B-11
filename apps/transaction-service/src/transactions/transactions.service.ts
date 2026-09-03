import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionStatus } from '@prisma/client-transaction';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ACCOUNT_SERVICE') private readonly accountClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async createTransaction(data: any) {
    this.logger.log(`Creating transaction...`);
    const correlationId = data.correlationId;

    const transaction = await this.prisma.transaction.create({
      data: {
        correlationId,
        sourceAccountId: data.sourceAccount,
        targetAccountId: data.targetAccount,
        amount: data.amount,
        status: TransactionStatus.PENDING,
      },
    });

    // FIX BUG #1: emit to accountClient (account_queue), NOT notificationClient
    // FIX BUG #2: flatten sourceAccountId/targetAccountId/amount to root level
    //             so Account Service can destructure them directly from `data`
    this.accountClient.emit('TransferRequested', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferRequested',
      correlationId,
      producer: 'transaction-service',
      sourceAccountId: data.sourceAccount,
      targetAccountId: data.targetAccount,
      amount: data.amount,
    });

    // Notify audit trail that the transfer was requested
    this.notificationClient.emit('TransferRequested', {
      eventId: crypto.randomUUID(),
      eventType: 'TransferRequested',
      correlationId,
      producer: 'transaction-service',
      payload: {
        sourceAccountId: data.sourceAccount,
        targetAccountId: data.targetAccount,
        amount: data.amount,
      },
    });

    return transaction;
  }

  async getTransaction(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  async getTransactionsByCustomer(customerId: string) {
    // FIX P5: queries transactions where either account ID contains the customerId segment.
    // Transaction Service stores accountIds (UUIDs), not customerId directly.
    // A production system would maintain a read-model via events from Account Service.
    return this.prisma.transaction.findMany({
      where: {
        OR: [{ sourceAccountId: customerId }, { targetAccountId: customerId }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeTransaction(correlationId: string, eventId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const updated = await tx.transaction.update({
        where: { correlationId },
        data: { status: TransactionStatus.COMPLETED },
      });

      await tx.processedEvent.create({
        data: { eventId, transactionId: updated.id },
      });

      return updated;
    });
  }

  async failTransaction(
    correlationId: string,
    reason: string,
    eventId: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const updated = await tx.transaction.update({
        where: { correlationId },
        data: { status: TransactionStatus.FAILED, failReason: reason },
      });

      await tx.processedEvent.create({
        data: { eventId, transactionId: updated.id },
      });

      return updated;
    });
  }
}

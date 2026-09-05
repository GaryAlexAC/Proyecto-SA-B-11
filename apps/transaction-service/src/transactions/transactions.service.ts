import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TransactionStatus } from '@prisma/client-transaction';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

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
        companyId: data.companyId,
        amount: data.amount,
        status: TransactionStatus.PENDING,
      },
    });

    // 1. Iniciar la Saga enviando el Comando ReserveFunds al Account Service
    this.accountClient.emit('ReserveFunds', {
      eventId: crypto.randomUUID(),
      eventType: 'ReserveFunds',
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

  async createPaymentTransaction(data: any) {
    this.logger.log(`Creating payment transaction...`);
    const transaction = await this.prisma.transaction.create({
      data: {
        correlationId: data.correlationId,
        sourceAccountId: data.sourceAccount,
        companyId: data.companyId,
        amount: data.amount,
        status: TransactionStatus.PENDING,
      },
    });

    this.accountClient.emit('ReserveFunds', {
      eventId: crypto.randomUUID(),
      eventType: 'ReserveFunds',
      correlationId: data.correlationId,
      producer: 'transaction-service',
      sourceAccountId: data.sourceAccount,
      targetAccountId: null,
      amount: data.amount,
    });

    return transaction;
  }

  async getTransaction(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  async getTransactionByCorrelation(correlationId: string) {
    return this.prisma.transaction.findUnique({ where: { correlationId } });
  }

  async getTransactionsByCustomer(
    customerId: string,
    authorization: string | undefined,
    correlationId: string,
  ) {
    const accounts = await firstValueFrom(
      this.accountClient
        .send<Array<{ id: string }>>('get_accounts_by_customer', {
          customerId,
          authorization,
          correlationId,
        })
        .pipe(timeout(8_000)),
    );
    const accountIds = accounts.map((account) => account.id);
    if (!accountIds.length) return [];

    return this.prisma.transaction.findMany({
      where: {
        OR: [
          { sourceAccountId: { in: accountIds } },
          { targetAccountId: { in: accountIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTransactionStatus(
    correlationId: string,
    status: TransactionStatus,
    eventId: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const updated = await tx.transaction.update({
        where: { correlationId },
        data: { status },
      });

      await tx.processedEvent.create({
        data: { eventId, transactionId: updated.id },
      });

      return updated;
    });
  }

  async completeTransaction(correlationId: string, eventId: string) {
    return await this.updateTransactionStatus(
      correlationId,
      TransactionStatus.COMPLETED,
      eventId,
    );
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

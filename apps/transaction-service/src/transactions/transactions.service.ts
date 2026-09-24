import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  Prisma,
  TransactionStatus,
} from '@prisma/client-transaction';
import { createHash } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import type { AuthenticatedUser, UserRole } from '../auth/jwt-auth.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface CreationContext {
  customerId: string;
  initiatedBy: string;
  initiatorRole: UserRole;
  idempotencyKey?: string;
}

export interface OutboxEventInput {
  id: string;
  eventType: string;
  correlationId: string;
  causationId?: string;
  payload: Record<string, unknown>;
}

export interface TransactionFilters {
  accountId?: string;
  status?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ACCOUNT_SERVICE') private readonly accountClient: ClientProxy,
    private readonly messaging: MessagingService,
  ) {}

  createTransaction(data: any, context: CreationContext) {
    return this.createSagaTransaction(data, context, false);
  }

  createPaymentTransaction(data: any, context: CreationContext) {
    return this.createSagaTransaction(data, context, true);
  }

  private async createSagaTransaction(
    data: any,
    context: CreationContext,
    payment: boolean,
  ) {
    const input = this.validateCreation(data, payment);
    const operation = payment ? 'PAYMENT' : 'TRANSFER';
    const requestHash = context.idempotencyKey
      ? this.fingerprint(
          input,
          operation,
          context.customerId,
        )
      : '';

    const replay = context.idempotencyKey
      ? await this.prisma.transaction.findUnique({
          where: { idempotencyKey: context.idempotencyKey },
        })
      : null;
    if (replay) return this.assertReplay(replay, operation, requestHash);

    this.logger.log(
      `Creating ${payment ? 'payment ' : ''}transaction for customer ${context.customerId}`,
    );

    try {
      const transaction = await this.prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            correlationId: input.correlationId,
            customerId: context.customerId,
            initiatedBy: context.initiatedBy,
            initiatorRole: context.initiatorRole,
            idempotencyKey: context.idempotencyKey,
            operation,
            requestHash: context.idempotencyKey ? requestHash : '',
            sourceAccountId: input.sourceAccountId,
            targetAccountId: input.targetAccountId,
            companyId: input.companyId,
            amount: input.amount,
            status: TransactionStatus.PENDING_KYC,
          },
        });

        await tx.outboxEvent.create({
          data: this.messaging.eventData(
            'KycValidationRequested',
            input.correlationId,
            {
              transactionId: created.id,
              customerId: context.customerId,
              initiatedBy: context.initiatedBy,
              initiatorRole: context.initiatorRole,
              sourceAccountId: input.sourceAccountId,
            },
            { id: `${input.correlationId}:kyc-validation-requested` },
          ),
        });



        return created;
      });

      void this.messaging.flush();
      return transaction;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = context.idempotencyKey
          ? await this.prisma.transaction.findUnique({
              where: { idempotencyKey: context.idempotencyKey },
            })
          : await this.prisma.transaction.findUnique({
              where: { correlationId: input.correlationId },
            });
        if (existing) {
          return this.assertReplay(existing, operation, requestHash);
        }
        throw new RpcException({
          statusCode: 409,
          error: 'La transacción ya fue registrada',
        });
      }
      throw error;
    }
  }

  async getTransaction(id: string, actor: AuthenticatedUser) {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        ...(actor.role === 'CLIENT' ? { customerId: actor.customerId } : {}),
      },
    });
  }

  async getTransactionByCorrelation(correlationId: string) {
    return this.prisma.transaction.findUnique({ where: { correlationId } });
  }

  async getTransactionsByCustomer(
    customerId: string,
    authorization: string | undefined,
    correlationId: string,
    filters: TransactionFilters = {},
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

    if (filters.accountId && !accountIds.includes(filters.accountId)) return [];
    const scopedIds = filters.accountId ? [filters.accountId] : accountIds;
    const where: Prisma.TransactionWhereInput = {
      OR: [
        { sourceAccountId: { in: scopedIds } },
        { targetAccountId: { in: scopedIds } },
      ],
    };

    if (filters.status) {
      if (!Object.values(TransactionStatus).includes(filters.status as TransactionStatus)) {
        throw new RpcException({ statusCode: 400, error: 'Estado inválido' });
      }
      where.status = filters.status as TransactionStatus;
    }

    const from = this.parseFilterDate(filters.from, false);
    const to = this.parseFilterDate(filters.to, true);
    if (from || to) where.createdAt = { gte: from, lte: to };

    return this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  approveKyc(
    correlationId: string,
    eventId: string,
    events: OutboxEventInput[] = [],
  ) {
    return this.updateTransactionStatus(
      correlationId,
      TransactionStatus.PENDING,
      eventId,
      [TransactionStatus.PENDING_KYC],
      events,
    );
  }

  rejectKyc(
    correlationId: string,
    reason: string,
    eventId: string,
    events: OutboxEventInput[] = [],
  ) {
    return this.failTransaction(correlationId, reason, eventId, [
      TransactionStatus.PENDING_KYC,
    ], events);
  }

  async updateTransactionStatus(
    correlationId: string,
    status: TransactionStatus,
    eventId: string,
    expectedStatuses: TransactionStatus[] = [
      TransactionStatus.PENDING,
      TransactionStatus.PROCESSING,
      TransactionStatus.COMPENSATING,
    ],
    events: OutboxEventInput[] = [],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const transaction = await tx.transaction.findUnique({
        where: { correlationId },
      });
      if (!transaction) return null;

      const result = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { in: expectedStatuses },
        },
        data: { status },
      });
      await tx.processedEvent.create({
        data: { eventId, transactionId: transaction.id },
      });
      if (result.count !== 1) return null;

      await this.enqueue(tx, events);
      return tx.transaction.findUniqueOrThrow({ where: { id: transaction.id } });
    });
  }

  completeTransaction(
    correlationId: string,
    eventId: string,
    events: OutboxEventInput[] = [],
  ) {
    return this.updateTransactionStatus(
      correlationId,
      TransactionStatus.APPROVED,
      eventId,
      [TransactionStatus.PENDING, TransactionStatus.PROCESSING],
      events,
    );
  }

  async failTransaction(
    correlationId: string,
    reason: string,
    eventId: string,
    expectedStatuses: TransactionStatus[] = [
      TransactionStatus.PENDING_KYC,
      TransactionStatus.PENDING,
      TransactionStatus.PROCESSING,
      TransactionStatus.COMPENSATING,
    ],
    events: OutboxEventInput[] = [],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const transaction = await tx.transaction.findUnique({
        where: { correlationId },
      });
      if (!transaction) return null;

      const result = await tx.transaction.updateMany({
        where: { id: transaction.id, status: { in: expectedStatuses } },
        data: { status: TransactionStatus.FAILED, failReason: reason },
      });
      await tx.processedEvent.create({
        data: { eventId, transactionId: transaction.id },
      });
      if (result.count !== 1) return null;

      await this.enqueue(tx, events);
      return tx.transaction.findUniqueOrThrow({ where: { id: transaction.id } });
    });
  }

  private async enqueue(
    tx: Prisma.TransactionClient,
    events: OutboxEventInput[],
  ) {
    for (const event of events) {
      await tx.outboxEvent.create({
        data: {
          id: event.id,
          eventType: event.eventType,
          correlationId: event.correlationId,
          causationId: event.causationId,
          producer: 'transaction-service',
          payload: event.payload as Prisma.InputJsonValue,
        },
      });
    }
  }

  private assertReplay(
    transaction: { operation: string; requestHash: string },
    operation: string,
    requestHash: string,
  ) {
    if (transaction.operation !== operation || transaction.requestHash !== requestHash) {
      throw new RpcException({
        statusCode: 409,
        error: 'Idempotency-Key ya fue usada en otra operación',
      });
    }
    return transaction;
  }

  private fingerprint(
    input: {
      correlationId: string;
      sourceAccountId: string;
      targetAccountId: string | null;
      companyId: string | null;
      amount: number;
    },
    operation: string,
    customerId: string,
  ) {
    const canonical = JSON.stringify({
      operation,
      customerId,
      sourceAccountId: input.sourceAccountId,
      targetAccountId: input.targetAccountId,
      companyId: input.companyId,
      amount: String(input.amount),
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  private validateCreation(data: any, payment: boolean) {
    const correlationId = this.requiredString(data.correlationId, 'correlationId');
    const sourceAccountId = this.requiredString(
      data.sourceAccount,
      'sourceAccount',
    );
    const targetAccountId = payment
      ? null
      : this.requiredString(data.targetAccount, 'targetAccount');
    if (targetAccountId === sourceAccountId) {
      throw new RpcException({
        statusCode: 400,
        error: 'Las cuentas origen y destino deben ser diferentes',
      });
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RpcException({
        statusCode: 400,
        error: 'El monto debe ser mayor que cero',
      });
    }
    const companyId = payment
      ? this.requiredString(data.companyId, 'companyId')
      : null;

    return {
      correlationId,
      sourceAccountId,
      targetAccountId,
      companyId,
      amount,
    };
  }

  private requiredString(value: unknown, name: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new RpcException({
        statusCode: 400,
        error: `${name} es obligatorio`,
      });
    }
    return value.trim();
  }

  private parseFilterDate(value: string | undefined, endOfDay: boolean) {
    if (!value) return undefined;
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
        : value,
    );
    if (Number.isNaN(date.valueOf())) {
      throw new RpcException({ statusCode: 400, error: 'Fecha inválida' });
    }
    return date;
  }
}
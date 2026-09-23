import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountStatus, AccountType, Prisma } from '@prisma/client-account';

export interface AccountCommandResult {
  eventType: string;
  payload: Record<string, unknown>;
  replayed: boolean;
}

const RESULT_SUFFIX: Record<string, string> = {
  FundsReserved: 'funds-reserved',
  FundsReservationRejected: 'funds-reservation-rejected',
  DestinationCredited: 'destination-credited',
  DestinationCreditRejected: 'destination-credit-rejected',
  FundsReleased: 'funds-released',
};

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createAccount(data: any) {
    this.logger.log(`Creating account for customer ${data.customerId}`);
    const account = await this.prisma.account.create({
      data: {
        customerId: data.customerId,
        type: data.type || AccountType.MONETARIA,
        balance: data.balance || 0,
        status: AccountStatus.ACTIVE,
      },
    });
    return account;
  }

  async getBalance(id: string, customerId?: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, customerId },
      select: { balance: true },
    });
    return account
      ? { balance: account.balance }
      : { error: 'Account not found' };
  }

  async getAccountsByCustomer(customerId: string) {
    return this.prisma.account.findMany({
      where: { customerId },
    });
  }

  // Paso 1: Reserva de fondos (Débito)
  async reserveFunds(
    sourceAccountId: string,
    targetAccountId: string | null,
    amount: number,
    correlationId: string,
    eventId: string,
    customerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) {
        this.logger.log(
          `Event ${eventId} already processed (idempotency check)`,
        );
        return this.toCommandResult(alreadyProcessed, true);
      }

      const sourceAccount = await tx.account.findUnique({
        where: { id: sourceAccountId },
      });
      let reason: string | undefined;
      if (!sourceAccount) reason = 'Source account not found';
      else if (!customerId || sourceAccount.customerId !== customerId) {
        reason = 'Source account does not belong to customer';
      } else if (sourceAccount.status !== AccountStatus.ACTIVE) {
        reason = 'Source account is not active';
      } else if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        reason = 'Amount must be greater than zero';
      } else if (Number(sourceAccount.balance) < Number(amount)) {
        reason = 'Insufficient funds';
      }

      if (!reason) {
        const updated = await tx.account.updateMany({
          where: {
            id: sourceAccountId,
            customerId,
            status: AccountStatus.ACTIVE,
            balance: { gte: amount },
          },
          data: { balance: { decrement: amount }, lastActivity: new Date() },
        });
        if (updated.count !== 1) {
          reason = 'Account balance changed; retry the transaction';
        }
      }

      const payload = {
        sourceAccountId,
        targetAccountId,
        amount: Number(amount),
        correlationId,
        ...(reason ? { reason } : {}),
      };
      const result = await this.recordResult(
        tx,
        eventId,
        sourceAccount?.id,
        reason ? 'FundsReservationRejected' : 'FundsReserved',
        payload,
      );

      if (!reason) {
        this.logger.log(
          `Funds reserved: ${amount} from ${sourceAccountId} [corr: ${correlationId}]`,
        );
      }
      return result;
    });
  }

  // Paso 2: Abono (Crédito)
  async applyCredit(
    sourceAccountId: string,
    targetAccountId: string,
    amount: number,
    correlationId: string,
    eventId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return this.toCommandResult(alreadyProcessed, true);

      const targetAccount = await tx.account.findUnique({
        where: { id: targetAccountId },
      });
      let reason: string | undefined;
      if (!targetAccount) reason = 'Target account not found';
      else if (targetAccount.status !== AccountStatus.ACTIVE) {
        reason = 'Target account is not active';
      } else if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        reason = 'Amount must be greater than zero';
      }

      if (!reason) {
        await tx.account.update({
          where: { id: targetAccountId },
          data: { balance: { increment: amount }, lastActivity: new Date() },
        });
      }

      const payload = {
        sourceAccountId,
        targetAccountId,
        amount: Number(amount),
        correlationId,
        ...(reason ? { reason } : {}),
      };
      const result = await this.recordResult(
        tx,
        eventId,
        targetAccount?.id,
        reason ? 'DestinationCreditRejected' : 'DestinationCredited',
        payload,
      );

      if (!reason) {
        this.logger.log(
          `Credit applied: ${amount} to ${targetAccountId} [corr: ${correlationId}]`,
        );
      }
      return result;
    });
  }

  // Paso 3 (Compensación): Reembolso (Rollback del Débito)
  async refundFunds(
    sourceAccountId: string,
    targetAccountId: string | null,
    amount: number,
    correlationId: string,
    eventId: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return this.toCommandResult(alreadyProcessed, true);

      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: { increment: amount }, lastActivity: new Date() },
      });

      const result = await this.recordResult(
        tx,
        eventId,
        sourceAccountId,
        'FundsReleased',
        {
          sourceAccountId,
          targetAccountId,
          amount: Number(amount),
          correlationId,
          ...(reason ? { reason } : {}),
        },
      );

      this.logger.log(
        `Refund applied (Compensating transaction): ${amount} to ${sourceAccountId} [corr: ${correlationId}]`,
      );
      return result;
    });
  }

private async recordResult(
    tx: Prisma.TransactionClient,
    eventId: string,
    accountId: string | undefined,
    resultEventType: string,
    resultPayload: Record<string, unknown>,
  ): Promise<AccountCommandResult> {
    const processed = await tx.processedEvent.create({
      data: {
        eventId,
        accountId,
        resultEventType,
        resultPayload: resultPayload as Prisma.InputJsonValue,
      },
    });
    const correlationId = String(resultPayload.correlationId ?? '');
    const suffix = RESULT_SUFFIX[resultEventType] ?? 'unknown';
    await tx.outboxEvent.create({
      data: {
        id: `${correlationId}:${suffix}`,
        eventType: resultEventType,
        correlationId,
        causationId: eventId,
        producer: 'account-service',
        payload: resultPayload as Prisma.InputJsonValue,
      },
    });
    return this.toCommandResult(processed, false);
  }

  private toCommandResult(
    processed: {
      resultEventType: string;
      resultPayload: Prisma.JsonValue;
    },
    replayed: boolean,
  ): AccountCommandResult {
    return {
      eventType: processed.resultEventType,
      payload: processed.resultPayload as Record<string, unknown>,
      replayed,
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deactivateInactiveAccounts() {
    this.logger.log(
      'Starting automated process: Deactivating inactive accounts',
    );
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await this.prisma.account.updateMany({
      where: {
        lastActivity: { lt: sixMonthsAgo },
        balance: { lt: 50.0 },
        status: AccountStatus.ACTIVE,
      },
      data: {
        status: AccountStatus.INACTIVE,
      },
    });

    this.logger.log(`Deactivated ${result.count} inactive accounts.`);
  }
}

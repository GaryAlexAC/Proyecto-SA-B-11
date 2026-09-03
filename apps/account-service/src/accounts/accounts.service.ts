import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountStatus, AccountType } from '@prisma/client-account';

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

  async getBalance(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
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
    targetAccountId: string,
    amount: number,
    correlationId: string,
    eventId: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) {
        this.logger.log(`Event ${eventId} already processed (idempotency check)`);
        return null;
      }

      const sourceAccount = await tx.account.findUnique({
        where: { id: sourceAccountId },
      });
      if (!sourceAccount) throw new Error('Source account not found');
      if (sourceAccount.status !== AccountStatus.ACTIVE)
        throw new Error('Source account is not active');
      if (Number(sourceAccount.balance) < amount)
        throw new Error('Insufficient funds');

      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: { decrement: amount }, lastActivity: new Date() },
      });

      await tx.processedEvent.create({
        data: { eventId, accountId: sourceAccountId },
      });

      this.logger.log(
        `Funds reserved: ${amount} from ${sourceAccountId} [corr: ${correlationId}]`,
      );
      return { sourceAccountId, targetAccountId, amount, correlationId };
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
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const targetAccount = await tx.account.findUnique({
        where: { id: targetAccountId },
      });
      if (!targetAccount) throw new Error('Target account not found');
      if (targetAccount.status !== AccountStatus.ACTIVE)
        throw new Error('Target account is not active');

      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: amount }, lastActivity: new Date() },
      });

      await tx.processedEvent.create({
        data: { eventId, accountId: targetAccountId },
      });

      this.logger.log(
        `Credit applied: ${amount} to ${targetAccountId} [corr: ${correlationId}]`,
      );
      return { sourceAccountId, targetAccountId, amount, correlationId };
    });
  }

  // Paso 3 (Compensación): Reembolso (Rollback del Débito)
  async refundFunds(
    sourceAccountId: string,
    amount: number,
    correlationId: string,
    eventId: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      await tx.account.update({
        where: { id: sourceAccountId },
        data: { balance: { increment: amount }, lastActivity: new Date() },
      });

      await tx.processedEvent.create({
        data: { eventId, accountId: sourceAccountId },
      });

      this.logger.log(
        `Refund applied (Compensating transaction): ${amount} to ${sourceAccountId} [corr: ${correlationId}]`,
      );
      return { sourceAccountId, amount, correlationId };
    });
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

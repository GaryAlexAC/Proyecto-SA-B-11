import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentStatus, PaymentType } from '@prisma/client-payment';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('TRANSACTION_SERVICE')
    private readonly transactionClient: ClientProxy,
  ) {}

  async createPayment(data: any) {
    this.logger.log(`Creating payment...`);
    const correlationId = data.correlationId;
    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { company: true },
    });
    if (!service) throw new Error('Service not found');

    const payment = await this.prisma.payment.create({
      data: {
        correlationId,
        // The payment is created before the saga starts so it can receive its result.
        transactionId: correlationId,
        amount: service.amount,
        type: PaymentType.EXTERNAL,
        status: PaymentStatus.PENDING,
        description: `${service.company.name} - ${service.name}`,
      },
    });

    try {
      const transaction = await firstValueFrom(
        this.transactionClient
          .send<{ id: string }>('create_payment_transaction', {
            sourceAccount: data.sourceAccountId,
            companyId: service.companyId,
            amount: service.amount,
            authorization: data.authorization,
            correlationId,
          })
          .pipe(timeout(8_000)),
      );

      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: transaction.id },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Transaction service unavailable';
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REJECTED, failReason: reason },
      });
    }
  }

  async getPayment(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  async getServices() {
    return this.prisma.service.findMany({
      include: { company: true },
      orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async completePayment(correlationId: string, eventId: string) {
    return this.updatePaymentStatus(correlationId, PaymentStatus.APPROVED, eventId);
  }

  async failPayment(correlationId: string, reason: string, eventId: string) {
    return this.updatePaymentStatus(
      correlationId,
      PaymentStatus.REJECTED,
      eventId,
      reason,
    );
  }

  private async updatePaymentStatus(
    correlationId: string,
    status: PaymentStatus,
    eventId: string,
    failReason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (alreadyProcessed) return null;

      const payment = await tx.payment.update({
        where: { correlationId },
        data: { status, failReason: failReason || null },
      });
      await tx.processedEvent.create({
        data: { eventId, paymentId: payment.id },
      });
      return payment;
    });
  }
}

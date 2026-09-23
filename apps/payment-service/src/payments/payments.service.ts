import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Payment, PaymentStatus, PaymentType } from '@prisma/client-payment';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, TimeoutError } from 'rxjs';
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
    const idempotencyKey =
      typeof data.idempotencyKey === 'string'
        ? data.idempotencyKey.trim()
        : '';
    if (!idempotencyKey) {
      throw new RpcException({
        statusCode: 400,
        error: 'Idempotency-Key es obligatoria para crear un pago',
      });
    }
    if (idempotencyKey.length > 100) {
      throw new RpcException({
        statusCode: 400,
        error: 'Idempotency-Key no puede superar 100 caracteres',
      });
    }

    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { company: true },
    });
    if (!service) {
      throw new RpcException({
        statusCode: 404,
        error: 'Service not found',
      });
    }

    const amount = service.amount.toString();
    const requestHash = this.fingerprint(
      data.customerId,
      data.sourceAccountId,
      service.id,
      amount,
      data.initiatedBy,
      data.initiatorRole,
    );

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new RpcException({
          statusCode: 409,
          error: 'Idempotency-Key reutilizada con un payload diferente',
        });
      }
      this.logger.log(
        `Replay idempotente devuelto para ${correlationId}`,
      );
      return existing;
    }

    let externalStatus = PaymentStatus.PENDING;
    let externalReason: string | undefined;

    const rand = Math.random();
    if (rand < 0.10) {
      this.logger.error(`Simulated external timeout for payment ${correlationId}`);
      this.transactionClient.emit('PaymentTimeout', {
        eventId: `${correlationId}:timeout`,
        correlationId,
        eventType: 'PaymentTimeout',
        payload: {
           transactionId: correlationId,
           reason: 'External service timeout simulated',
           severity: 'ERROR',
        }
      });
      externalStatus = PaymentStatus.REJECTED;
      externalReason = 'Timeout de servicio externo simulado';
    } else if (rand < 0.30) {
      this.logger.warn(`Simulated external rejection for payment ${correlationId}`);
      externalStatus = PaymentStatus.REJECTED;
      externalReason = 'Rechazo de servicio externo simulado';
    }

    let payment: Payment;
    try {
      payment = await this.prisma.payment.create({
        data: {
          correlationId,
          // The payment is created before the saga starts so it can receive its result.
          transactionId: correlationId,
          amount: service.amount,
          type: PaymentType.EXTERNAL,
          status: externalStatus,
          failReason: externalReason || null,
          description: `${service.company.name} - ${service.name}`,
          idempotencyKey,
          requestHash,
          customerId: data.customerId,
          initiatedBy: data.initiatedBy,
          sourceAccountId: data.sourceAccountId,
          serviceId: service.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const created = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
        });
        if (created && created.requestHash === requestHash) {
          return created;
        }
        throw new RpcException({
          statusCode: 409,
          error: 'Idempotency-Key reutilizada con un payload diferente',
        });
      }
      throw error;
    }

    if (externalStatus === PaymentStatus.REJECTED) {
      return payment;
    }

    try {
      const transaction = await firstValueFrom(
        this.transactionClient
          .send<{ id: string }>('create_payment_transaction', {
            sourceAccount: data.sourceAccountId,
            companyId: service.companyId,
            amount: service.amount,
            authorization: data.authorization,
            correlationId,
            customerId: data.customerId,
            initiatedBy: data.initiatedBy,
            initiatorRole: data.initiatorRole,
            idempotencyKey,
          })
          .pipe(timeout(8_000)),
      );

      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: transaction.id },
      });
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.logger.warn(
          `Timeout aguardando la saga de ${correlationId}; queda en PENDING para reconciliación`,
        );
        return this.prisma.payment.update({
          where: { id: payment.id },
          data: { failReason: 'Timeout aguardando la saga de pago' },
        });
      }
      const statusCode =
        typeof (error as any)?.error?.statusCode === 'number'
          ? (error as any).error.statusCode
          : undefined;
      const reason =
        error instanceof Error ? error.message : 'Transaction service unavailable';
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:
            statusCode !== undefined && statusCode >= 400 && statusCode < 500
              ? PaymentStatus.REJECTED
              : PaymentStatus.PENDING,
          failReason: reason,
        },
      });
    }
  }

  private fingerprint(
    customerId: string,
    sourceAccountId: string | undefined,
    serviceId: string,
    amount: string,
    initiatedBy: string,
    initiatorRole: string,
  ) {
    const canonical = JSON.stringify({
      customerId,
      sourceAccountId: sourceAccountId ?? '',
      serviceId,
      amount,
      initiatedBy,
      initiatorRole,
    });
    return createHash('sha256').update(canonical).digest('hex');
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

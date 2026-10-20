import { Injectable, Logger, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, Payment, PaymentStatus, PaymentType } from '@prisma/client-payment';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { injectTraceContext } from '@bank-usac/observability';
import { getMeter } from '@bank-usac/observability';

export interface PaymentSimulationConfig {
  failureRatePercent: number;
  timeoutRatePercent: number;
  latencyMs: number;
  timeoutMs: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private simulation: PaymentSimulationConfig = {
    failureRatePercent: Number(process.env.PAYMENT_FAILURE_RATE_PERCENT ?? 20),
    timeoutRatePercent: Number(process.env.PAYMENT_TIMEOUT_RATE_PERCENT ?? 10),
    latencyMs: Number(process.env.PAYMENT_LATENCY_MS ?? 0),
    timeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS ?? 3_000),
  };
  private readonly externalFailures = getMeter('payment-service').createCounter(
    'payment_external_failures_total',
    { description: 'Fallos del sistema externo simulado' },
  );
  private readonly externalLatency = getMeter('payment-service').createHistogram(
    'payment_external_latency_ms',
    { description: 'Latencia del sistema externo simulado', unit: 'ms' },
  );

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

    let externalStatus: PaymentStatus = PaymentStatus.PENDING;
    let externalReason: string | undefined;

    const simulationStartedAt = Date.now();
    if (this.simulation.latencyMs > 0) {
      await this.delay(this.simulation.latencyMs);
    }
    this.externalLatency.record(Date.now() - simulationStartedAt);

    const rand = Math.random();
    const timeoutLimit = this.simulation.timeoutRatePercent / 100;
    const failureLimit =
      timeoutLimit + this.simulation.failureRatePercent / 100;
    if (rand < timeoutLimit) {
      if (this.simulation.timeoutMs > 0) {
        await this.delay(this.simulation.timeoutMs);
      }
      this.externalFailures.add(1, { failure_type: 'timeout' });
      this.logger.error(`Simulated external timeout for payment ${correlationId}`);
      this.transactionClient.emit('PaymentTimeout', injectTraceContext({
        eventId: `${correlationId}:timeout`,
        correlationId,
        eventType: 'PaymentTimeout',
        payload: {
           transactionId: correlationId,
           reason: 'External service timeout simulated',
           severity: 'ERROR',
        }
      }));
      externalStatus = PaymentStatus.REJECTED;
      externalReason = 'Timeout de servicio externo simulado';
    } else if (rand < failureLimit) {
      this.externalFailures.add(1, { failure_type: 'rejection' });
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

  getSimulationConfig() {
    return { ...this.simulation };
  }

  updateSimulationConfig(input: Partial<PaymentSimulationConfig>) {
    const next = { ...this.simulation, ...input };
    if (
      !Number.isFinite(next.failureRatePercent) ||
      !Number.isFinite(next.timeoutRatePercent) ||
      next.failureRatePercent < 0 ||
      next.timeoutRatePercent < 0 ||
      next.failureRatePercent + next.timeoutRatePercent > 100 ||
      !Number.isInteger(next.latencyMs) ||
      !Number.isInteger(next.timeoutMs) ||
      next.latencyMs < 0 ||
      next.timeoutMs < 0
    ) {
      throw new RpcException({
        statusCode: 400,
        error: 'Configuración de simulación inválida',
      });
    }
    this.simulation = next;
    return this.getSimulationConfig();
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

  private delay(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}

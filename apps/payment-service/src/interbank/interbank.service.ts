import { Injectable, Logger, Inject } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { createHash, randomUUID } from 'node:crypto';
import { firstValueFrom, timeout } from 'rxjs';
import { getMeter } from '@bank-usac/observability';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  TransferRequest,
  TransferAck,
  TransferStatusResponse,
  TransferResult,
  CallbackAck,
  CancelRequest,
  CancelResponse,
  ReversalRequest,
  ReversalStatusResponse,
  ReconciliationPage,
  InterbankMockConfig,
  OutgoingTransferDto,
  ReasonCode,
} from './interbank.types.js';

@Injectable()
export class InterbankService {
  private readonly logger = new Logger(InterbankService.name);

  readonly bankCode = process.env.BANK_CODE || 'BANK11';
  readonly partnerBankCode = process.env.PARTNER_BANK_CODE || 'BANK06';
  readonly partnerBankUrl = (
    process.env.PARTNER_BANK_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');
  readonly partnerApiKey = process.env.PARTNER_API_KEY || 'partner-api-key-test';
  readonly myApiKey = process.env.INTERBANK_API_KEY || 'bank11-api-key-test';

  private mockConfig: InterbankMockConfig = {
    enabled: process.env.INTERBANK_MOCK_ENABLED !== 'false',
    behavior:
      (process.env.INTERBANK_MOCK_BEHAVIOR as 'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'SLOW') ||
      'SUCCESS',
    rejectReason: 'ACCOUNT_NOT_FOUND',
    latencyMs: Number(process.env.INTERBANK_MOCK_LATENCY_MS ?? 1_000),
  };

  private readonly receivedCounter = getMeter('payment-service').createCounter(
    'interbank_transfers_received_total',
    { description: 'Depósitos interbancarios recibidos' },
  );
  private readonly sentCounter = getMeter('payment-service').createCounter(
    'interbank_transfers_sent_total',
    { description: 'Depósitos interbancarios enviados' },
  );
  private readonly latencyHistogram = getMeter('payment-service').createHistogram(
    'interbank_confirmation_latency_ms',
    { description: 'Latencia de confirmación del banco pareja', unit: 'ms' },
  );
  private readonly timeoutCounter = getMeter('payment-service').createCounter(
    'interbank_partner_timeouts_total',
    { description: 'Timeouts con el banco pareja' },
  );

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ACCOUNT_SERVICE') private readonly accountClient: ClientProxy,
    @Inject('TRANSACTION_SERVICE') private readonly transactionClient: ClientProxy,
  ) {}

  getMockConfig(): InterbankMockConfig {
    return { ...this.mockConfig };
  }

  updateMockConfig(patch: Partial<InterbankMockConfig>): InterbankMockConfig {
    this.mockConfig = {
      ...this.mockConfig,
      ...patch,
    };
    this.logger.log(
      `Interbank Mock updated: enabled=${this.mockConfig.enabled}, behavior=${this.mockConfig.behavior}`,
    );
    return { ...this.mockConfig };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. BANCO RECEPTOR: Recibir depósito de otro banco
  // ─────────────────────────────────────────────────────────────
  async receiveTransfer(
    payload: TransferRequest,
    traceparent?: string,
    idempotencyKey?: string,
  ): Promise<{ status: number; body: TransferAck | TransferStatusResponse }> {
    this.receivedCounter.add(1, { origin_bank: payload.originBankCode });
    this.logger.log(
      `Received interbank transfer ${payload.interbankTransferId} from ${payload.originBankCode} for amount ${payload.amount}`,
    );

    // 1. Validar expiración (expiresAt en el pasado)
    const expiresAt = new Date(payload.expiresAt);
    if (expiresAt.getTime() < Date.now()) {
      throw new RpcException({
        statusCode: 422,
        error: 'El mensaje ha expirado',
        code: 'EXPIRED',
        reasonCode: 'EXPIRED',
      });
    }

    const requestHash = this.computeHash(payload);

    // 2. Validar idempotencia
    const existing = await (this.prisma as any).interbankTransfer.findUnique({
      where: { interbankTransferId: payload.interbankTransferId },
    });

    if (existing) {
      if (existing.requestHash === requestHash) {
        return {
          status: 200,
          body: {
            interbankTransferId: existing.interbankTransferId,
            status: existing.status,
            reasonCode: existing.reasonCode ?? undefined,
            updatedAt: existing.updatedAt.toISOString(),
          },
        };
      }
      throw new RpcException({
        statusCode: 409,
        error: 'El ID ya fue utilizado con un contenido diferente',
        code: 'IDEMPOTENCY_CONFLICT',
      });
    }

    // 3. Crear registro en estado PROCESSING
    const created = await (this.prisma as any).interbankTransfer.create({
      data: {
        interbankTransferId: payload.interbankTransferId,
        direction: 'INCOMING',
        originBankCode: payload.originBankCode,
        destinationBankCode: payload.destinationBankCode,
        originAccount: payload.originAccount,
        destinationAccount: payload.destinationAccount,
        amount: payload.amount,
        currency: payload.currency ?? 'GTQ',
        description: payload.description,
        status: 'PROCESSING',
        requestHash,
        idempotencyKey: idempotencyKey ?? payload.interbankTransferId,
        traceparent,
        correlationId: payload.interbankTransferId,
        expiresAt,
      },
    });

    // 4. Procesar asíncronamente (acreditar y enviar callback)
    void this.processIncomingTransfer(created, payload, traceparent);

    return {
      status: 202,
      body: {
        interbankTransferId: payload.interbankTransferId,
        status: 'PROCESSING',
        receivedAt: new Date().toISOString(),
      },
    };
  }

  private async processIncomingTransfer(
    transfer: any,
    payload: TransferRequest,
    traceparent?: string,
  ) {
    let finalStatus: 'ACCEPTED' | 'REJECTED' = 'ACCEPTED';
    let reasonCode: ReasonCode | undefined;
    let reasonMessage: string | undefined;

    try {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        finalStatus = 'REJECTED';
        reasonCode = 'PROCESSING_ERROR';
        reasonMessage = 'Monto inválido';
      } else if (amount > 10_000.0) {
        finalStatus = 'REJECTED';
        reasonCode = 'AMOUNT_LIMIT_EXCEEDED';
        reasonMessage = 'El monto excede el límite permitido de Q10,000.00';
      } else if (payload.currency !== 'GTQ') {
        finalStatus = 'REJECTED';
        reasonCode = 'CURRENCY_NOT_SUPPORTED';
        reasonMessage = 'Moneda no soportada';
      } else {
        // Verificar si la cuenta destino existe y está activa
        const account = await firstValueFrom(
          this.accountClient
            .send('get_account', { id: payload.destinationAccount })
            .pipe(timeout(6_000)),
        ).catch(() => null);

        if (!account) {
          finalStatus = 'REJECTED';
          reasonCode = 'ACCOUNT_NOT_FOUND';
          reasonMessage = 'Cuenta destino no encontrada';
        } else if (account.status !== 'ACTIVE') {
          finalStatus = 'REJECTED';
          reasonCode = 'ACCOUNT_INACTIVE';
          reasonMessage = 'Cuenta destino inactiva';
        } else {
          // Acreditar saldo
          const creditResult = await firstValueFrom(
            this.accountClient
              .send('interbank_credit', {
                targetAccountId: payload.destinationAccount,
                amount,
                correlationId: payload.interbankTransferId,
                eventId: `interbank-credit:${payload.interbankTransferId}`,
              })
              .pipe(timeout(8_000)),
          ).catch((err) => ({
            eventType: 'DestinationCreditRejected',
            payload: { reason: err.message },
          }));

          if (creditResult.eventType === 'DestinationCreditRejected') {
            finalStatus = 'REJECTED';
            reasonCode = 'PROCESSING_ERROR';
            reasonMessage = creditResult.payload?.reason ?? 'Error acreditando fondos';
          }
        }
      }
    } catch (err: any) {
      finalStatus = 'REJECTED';
      reasonCode = 'PROCESSING_ERROR';
      reasonMessage = err.message ?? 'Fallo interno al procesar depósito';
    }

    // Actualizar registro en DB
    await (this.prisma as any).interbankTransfer.update({
      where: { interbankTransferId: payload.interbankTransferId },
      data: {
        status: finalStatus,
        reasonCode: reasonCode ?? null,
        reasonMessage: reasonMessage ?? null,
        processedAt: new Date(),
      },
    });

    // Enviar Callback al banco emisor
    const callbackResult: TransferResult = {
      interbankTransferId: payload.interbankTransferId,
      destinationBankCode: this.bankCode,
      status: finalStatus,
      ...(reasonCode ? { reasonCode } : {}),
      ...(reasonMessage ? { reasonMessage } : {}),
      processedAt: new Date().toISOString(),
    };

    await this.deliverCallback(payload.originBankCode, callbackResult, traceparent);
  }

  private async deliverCallback(
    originBankCode: string,
    result: TransferResult,
    traceparent?: string,
  ) {
    const callbackUrl = `${this.partnerBankUrl}/interbank/v1/transfers/${result.interbankTransferId}/result`;
    this.logger.log(
      `Sending callback to ${originBankCode} at ${callbackUrl}: status=${result.status}`,
    );

    // Si el banco de origen es MOCK o estamos en modo mock local
    if (this.mockConfig.enabled && originBankCode === this.partnerBankCode) {
      this.logger.log(`Mock partner callback simulated successfully.`);
      return;
    }

    // Intentar entrega con reintentos
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.partnerApiKey,
            ...(traceparent ? { traceparent } : {}),
          },
          body: JSON.stringify(result),
        });
        if (response.ok) {
          this.logger.log(
            `Callback delivered successfully on attempt ${attempt}`,
          );
          await (this.prisma as any).interbankTransfer.update({
            where: { interbankTransferId: result.interbankTransferId },
            data: {
              callbackAttempts: attempt,
              callbackDeliveredAt: new Date(),
            },
          });
          return;
        }
      } catch (err: any) {
        this.logger.warn(
          `Callback attempt ${attempt} failed: ${err.message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. BANCO RECEPTOR: Consultar estado
  // ─────────────────────────────────────────────────────────────
  async getTransfer(interbankTransferId: string): Promise<TransferStatusResponse> {
    const transfer = await (this.prisma as any).interbankTransfer.findUnique({
      where: { interbankTransferId },
    });
    if (!transfer) {
      throw new RpcException({
        statusCode: 404,
        error: 'Depósito no encontrado',
      });
    }

    return {
      interbankTransferId: transfer.interbankTransferId,
      status: transfer.status,
      reasonCode: transfer.reasonCode ?? undefined,
      updatedAt: transfer.updatedAt.toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. BANCO RECEPTOR: Cancelar depósito en duda
  // ─────────────────────────────────────────────────────────────
  async cancelTransfer(
    interbankTransferId: string,
    cancelReq: CancelRequest,
  ): Promise<CancelResponse> {
    const transfer = await (this.prisma as any).interbankTransfer.findUnique({
      where: { interbankTransferId },
    });

    const nowIso = new Date().toISOString();

    if (!transfer) {
      // Registrar como cancelada para rechazar si llega luego
      await (this.prisma as any).interbankTransfer.create({
        data: {
          interbankTransferId,
          direction: 'INCOMING',
          originBankCode: this.partnerBankCode,
          destinationBankCode: this.bankCode,
          originAccount: 'UNKNOWN',
          destinationAccount: 'UNKNOWN',
          amount: '0.00',
          status: 'CANCELLED',
          reasonCode: 'CANCELLED',
          requestHash: 'CANCELLED',
          idempotencyKey: interbankTransferId,
          expiresAt: new Date(),
        },
      });
      return {
        interbankTransferId,
        status: 'CANCELLED',
        cancelledAt: nowIso,
      };
    }

    if (transfer.status === 'ACCEPTED') {
      return {
        interbankTransferId,
        status: 'ALREADY_ACCEPTED',
        cancelledAt: nowIso,
      };
    }

    if (transfer.status === 'REJECTED') {
      return {
        interbankTransferId,
        status: 'ALREADY_REJECTED',
        cancelledAt: nowIso,
      };
    }

    // Si estaba en PROCESSING o PENDING
    await (this.prisma as any).interbankTransfer.update({
      where: { interbankTransferId },
      data: {
        status: 'CANCELLED',
        reasonCode: 'CANCELLED',
        reasonMessage: cancelReq.reason,
      },
    });

    return {
      interbankTransferId,
      status: 'CANCELLED',
      cancelledAt: nowIso,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. BANCO EMISOR: Callback con el resultado
  // ─────────────────────────────────────────────────────────────
  async receiveTransferResult(
    payload: TransferResult,
    traceparent?: string,
  ): Promise<CallbackAck> {
    this.logger.log(
      `Received result callback for transfer ${payload.interbankTransferId}: ${payload.status}`,
    );

    const transfer = await (this.prisma as any).interbankTransfer.findUnique({
      where: { interbankTransferId: payload.interbankTransferId },
    });

    if (!transfer) {
      throw new RpcException({
        statusCode: 404,
        error: 'Transferencia no encontrada en este banco emisor',
      });
    }

    if (payload.status === 'ACCEPTED') {
      await (this.prisma as any).interbankTransfer.update({
        where: { interbankTransferId: payload.interbankTransferId },
        data: {
          status: 'ACCEPTED',
          processedAt: new Date(payload.processedAt),
        },
      });
      this.logger.log(
        `Outgoing transfer ${payload.interbankTransferId} successfully confirmed (ACCEPTED)`,
      );
    } else if (payload.status === 'REJECTED') {
      await (this.prisma as any).interbankTransfer.update({
        where: { interbankTransferId: payload.interbankTransferId },
        data: {
          status: 'REVERSED',
          reasonCode: payload.reasonCode ?? 'REJECTED',
          reasonMessage: payload.reasonMessage,
          processedAt: new Date(payload.processedAt),
        },
      });

      // Ejecutar compensación en la Saga: reembolsar los fondos al cliente
      this.logger.warn(
        `Outgoing transfer ${payload.interbankTransferId} rejected by partner bank. Reversing funds.`,
      );
      await firstValueFrom(
        this.accountClient
          .send('interbank_refund', {
            sourceAccountId: transfer.originAccount,
            amount: Number(transfer.amount),
            correlationId: transfer.correlationId,
            eventId: `interbank-refund:${payload.interbankTransferId}`,
            reason: payload.reasonMessage ?? payload.reasonCode ?? 'Transferencia interbancaria rechazada',
          })
          .pipe(timeout(8_000)),
      ).catch((err) => {
        this.logger.error(`Error refunding funds in saga compensation: ${err.message}`);
      });
    }

    return {
      interbankTransferId: payload.interbankTransferId,
      status: payload.status,
      acknowledgedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 5. BANCO EMISOR: Iniciar transferencia saliente (Cliente -> BANK06)
  // ─────────────────────────────────────────────────────────────
  async initiateOutgoingTransfer(
    dto: OutgoingTransferDto,
    customerId: string,
    correlationId: string,
    traceparent?: string,
  ) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RpcException({ statusCode: 400, error: 'Monto debe ser mayor a 0' });
    }
    if (amount > 10_000.0) {
      throw new RpcException({
        statusCode: 400,
        error: 'El monto máximo interbancario es de Q10,000.00',
      });
    }

    const interbankTransferId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 180_000);

    // 1. Reservar fondos en la cuenta origen
    const reserveResult = await firstValueFrom(
      this.accountClient
        .send('interbank_reserve', {
          sourceAccountId: dto.sourceAccountId,
          amount,
          correlationId,
          eventId: `interbank-reserve:${interbankTransferId}`,
          customerId,
        })
        .pipe(timeout(8_000)),
    ).catch((err) => ({
      eventType: 'FundsReservationRejected',
      payload: { reason: err.message },
    }));

    if (reserveResult.eventType === 'FundsReservationRejected') {
      throw new RpcException({
        statusCode: 400,
        error: reserveResult.payload?.reason ?? 'Fondos insuficientes o saldo mínimo violado',
      });
    }

    // 2. Guardar registro local como SENT
    const transferReq: TransferRequest = {
      interbankTransferId,
      originBankCode: this.bankCode,
      destinationBankCode: dto.destinationBankCode || this.partnerBankCode,
      originAccount: dto.sourceAccountId,
      destinationAccount: dto.destinationAccount,
      amount: amount.toFixed(2),
      currency: 'GTQ',
      description: dto.description,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const requestHash = this.computeHash(transferReq);

    await (this.prisma as any).interbankTransfer.create({
      data: {
        interbankTransferId,
        direction: 'OUTGOING',
        originBankCode: this.bankCode,
        destinationBankCode: transferReq.destinationBankCode,
        originAccount: transferReq.originAccount,
        destinationAccount: transferReq.destinationAccount,
        amount: transferReq.amount,
        currency: 'GTQ',
        description: transferReq.description,
        status: 'SENT',
        requestHash,
        idempotencyKey: interbankTransferId,
        traceparent,
        correlationId,
        expiresAt,
      },
    });

    this.sentCounter.add(1, { destination_bank: transferReq.destinationBankCode });

    // 3. Despachar solicitud al banco destino o al MOCK
    void this.dispatchOutgoingTransfer(transferReq, correlationId, traceparent);

    return {
      interbankTransferId,
      status: 'SENT',
      originBankCode: this.bankCode,
      destinationBankCode: transferReq.destinationBankCode,
      amount: transferReq.amount,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async dispatchOutgoingTransfer(
    req: TransferRequest,
    correlationId: string,
    traceparent?: string,
  ) {
    const startTime = Date.now();

    // MOCK SIMULATION HANDLER
    if (this.mockConfig.enabled && req.destinationBankCode === this.partnerBankCode) {
      this.logger.log(
        `[MOCK PARTNER] Handling outgoing transfer ${req.interbankTransferId} with behavior: ${this.mockConfig.behavior}`,
      );

      if (this.mockConfig.behavior === 'TIMEOUT') {
        this.timeoutCounter.add(1);
        this.logger.warn(`[MOCK PARTNER] Simulating TIMEOUT: no callback will be returned.`);
        return;
      }

      const delayMs = this.mockConfig.behavior === 'SLOW' ? 8_000 : this.mockConfig.latencyMs;
      await new Promise((r) => setTimeout(r, delayMs));

      if (this.mockConfig.behavior === 'REJECT') {
        await this.receiveTransferResult({
          interbankTransferId: req.interbankTransferId,
          destinationBankCode: this.partnerBankCode,
          status: 'REJECTED',
          reasonCode: this.mockConfig.rejectReason,
          reasonMessage: 'Simulated rejection by partner bank mock',
          processedAt: new Date().toISOString(),
        });
      } else {
        // SUCCESS
        await this.receiveTransferResult({
          interbankTransferId: req.interbankTransferId,
          destinationBankCode: this.partnerBankCode,
          status: 'ACCEPTED',
          processedAt: new Date().toISOString(),
        });
      }

      this.latencyHistogram.record(Date.now() - startTime);
      return;
    }

    // REAL HTTP DISPATCH TO PARTNER BANK
    const partnerEndpoint = `${this.partnerBankUrl}/interbank/v1/transfers`;
    try {
      this.logger.log(`Dispatching transfer ${req.interbankTransferId} to ${partnerEndpoint}`);
      const res = await fetch(partnerEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.partnerApiKey,
          'Idempotency-Key': req.interbankTransferId,
          ...(traceparent ? { traceparent } : {}),
        },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        this.logger.error(`Partner bank returned status ${res.status}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to reach partner bank: ${err.message}`);
      this.timeoutCounter.add(1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. CONCILIACIÓN DIARIA
  // ─────────────────────────────────────────────────────────────
  async getReconciliation(
    dateStr: string,
    page: number = 1,
    pageSize: number = 100,
    callingBankCode: string,
  ): Promise<ReconciliationPage> {
    const targetDate = new Date(dateStr);
    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const where = {
      direction: 'INCOMING',
      originBankCode: callingBankCode,
      createdAt: {
        gte: targetDate,
        lt: nextDay,
      },
    };

    const totalTransfers = await (this.prisma as any).interbankTransfer.count({ where });
    const records = await (this.prisma as any).interbankTransfer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
    });

    const totalAmount = records
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      .toFixed(2);

    return {
      date: dateStr,
      totalTransfers,
      totalAmount,
      page,
      pageSize,
      totalPages: Math.ceil(totalTransfers / pageSize) || 1,
      transfers: records.map((r: any) => ({
        interbankTransferId: r.interbankTransferId,
        originBankCode: r.originBankCode,
        destinationBankCode: r.destinationBankCode,
        originAccount: r.originAccount,
        destinationAccount: r.destinationAccount,
        amount: Number(r.amount).toFixed(2),
        status: r.status,
        reasonCode: r.reasonCode ?? undefined,
        processedAt: (r.processedAt ?? r.updatedAt).toISOString(),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. CONSULTAR HISTORIAL INTERBANCARIO (Para Frontend)
  // ─────────────────────────────────────────────────────────────
  async listTransfers(limit: number = 50) {
    return (this.prisma as any).interbankTransfer.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  private computeHash(payload: any): string {
    const serialized = JSON.stringify({
      id: payload.interbankTransferId,
      originBank: payload.originBankCode,
      destBank: payload.destinationBankCode,
      originAcc: payload.originAccount,
      destAcc: payload.destinationAccount,
      amount: payload.amount,
      curr: payload.currency,
    });
    return createHash('sha256').update(serialized).digest('hex');
  }
}

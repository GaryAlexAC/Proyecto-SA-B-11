import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '@prisma/client-transaction';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';

export type TransactionEventType =
  | 'KycValidationRequested'
  | 'TransferRequested'
  | 'TransferCompleted'
  | 'TransferFailed'
  | 'ReserveFunds'
  | 'CreditDestination'
  | 'ReleaseFunds'
  | 'PaymentTransactionCompleted'
  | 'PaymentTransactionFailed';

interface EventOptions {
  id: string;
  causationId?: string;
}

const CLIENT_BY_EVENT: Record<string, string> = {
  KycValidationRequested: 'CUSTOMER_SERVICE',
  TransferRequested: 'NOTIFICATION_SERVICE',
  TransferCompleted: 'NOTIFICATION_SERVICE',
  TransferFailed: 'NOTIFICATION_SERVICE',
  ReserveFunds: 'ACCOUNT_SERVICE',
  CreditDestination: 'ACCOUNT_SERVICE',
  ReleaseFunds: 'ACCOUNT_SERVICE',
  PaymentTransactionCompleted: 'PAYMENT_SERVICE',
  PaymentTransactionFailed: 'PAYMENT_SERVICE',
};

@Injectable()
export class MessagingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private readonly retryDelays = [5_000, 15_000, 30_000];
  private timer?: NodeJS.Timeout;
  private flushing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('ACCOUNT_SERVICE') private readonly accountClient: ClientProxy,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.flush(), 5_000);
    void this.flush();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all([
      this.accountClient.close(),
      this.customerClient.close(),
      this.notificationClient.close(),
      this.paymentClient.close(),
    ]);
  }

  eventData(
    eventType: TransactionEventType,
    correlationId: string,
    payload: Record<string, unknown>,
    options: EventOptions,
  ): Prisma.OutboxEventUncheckedCreateInput {
    return {
      id: options.id,
      eventType,
      correlationId,
      causationId: options.causationId,
      payload: payload as Prisma.InputJsonValue,
    };
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;

    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          publishedAt: null,
          failedAt: null,
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { occurredAt: 'asc' },
        take: 50,
      });

      for (const event of events) {
        try {
          const client = this.clientFor(event.eventType);
          await firstValueFrom(
            client.emit(event.eventType, {
              eventId: event.id,
              eventType: event.eventType,
              eventVersion: event.eventVersion,
              occurredAt: event.occurredAt.toISOString(),
              correlationId: event.correlationId,
              causationId: event.causationId,
              producer: event.producer,
              payload: event.payload,
            }),
          );
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { publishedAt: new Date(), lastError: null },
          });
        } catch (error) {
          const attempts = event.attempts + 1;
          const exhausted = attempts > this.retryDelays.length;
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts,
              lastError:
                error instanceof Error ? error.message : 'Unknown error',
              failedAt: exhausted ? new Date() : null,
              nextAttemptAt: exhausted
                ? event.nextAttemptAt
                : new Date(Date.now() + this.retryDelays[attempts - 1]),
            },
          });
          this.logger.warn(
            `No se pudo publicar ${event.eventType}: intento ${attempts}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `No se pudo procesar el outbox: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      this.flushing = false;
    }
  }

  private clientFor(eventType: string): ClientProxy {
    switch (CLIENT_BY_EVENT[eventType]) {
      case 'ACCOUNT_SERVICE':
        return this.accountClient;
      case 'CUSTOMER_SERVICE':
        return this.customerClient;
      case 'PAYMENT_SERVICE':
        return this.paymentClient;
      default:
        return this.notificationClient;
    }
  }
}
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Prisma } from '@prisma/client-account';
import { firstValueFrom } from 'rxjs';
import { injectTraceContext } from '@bank-usac/observability';
import { PrismaService } from '../prisma/prisma.service.js';

export type AccountEventType =
  | 'FundsReserved'
  | 'FundsReservationRejected'
  | 'DestinationCredited'
  | 'DestinationCreditRejected'
  | 'FundsReleased';

interface EventOptions {
  id: string;
  causationId?: string;
}

@Injectable()
export class MessagingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private readonly retryDelays = [5_000, 15_000, 30_000];
  private timer?: NodeJS.Timeout;
  private flushing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('TRANSACTION_SERVICE')
    private readonly transactionClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.flush(), 5_000);
    void this.flush();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.all([
      this.transactionClient.close(),
      this.notificationClient.close(),
    ]);
  }

  eventData(
    eventType: AccountEventType,
    correlationId: string,
    payload: Record<string, unknown>,
    options: EventOptions,
  ): Prisma.OutboxEventUncheckedCreateInput {
    return {
      id: options.id,
      eventType,
      correlationId,
      causationId: options.causationId,
      payload: injectTraceContext(payload) as Prisma.InputJsonValue,
    };
  }

  async publish(eventType: string, envelope: Record<string, unknown>) {
    await firstValueFrom(
      this.transactionClient.emit(eventType, injectTraceContext(envelope)),
    );
  }

  async publishNotification(
    eventType: string,
    envelope: Record<string, unknown>,
  ) {
    await firstValueFrom(
      this.notificationClient.emit(eventType, injectTraceContext(envelope)),
    );
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
          await firstValueFrom(
            this.transactionClient.emit(event.eventType, injectTraceContext({
              eventId: event.id,
              eventType: event.eventType,
              eventVersion: event.eventVersion,
              occurredAt: event.occurredAt.toISOString(),
              correlationId: event.correlationId,
              causationId: event.causationId,
              producer: event.producer,
              payload: event.payload,
              traceparent:
                event.payload && typeof event.payload === 'object'
                  ? (event.payload as { traceparent?: string }).traceparent
                  : undefined,
            })),
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
}

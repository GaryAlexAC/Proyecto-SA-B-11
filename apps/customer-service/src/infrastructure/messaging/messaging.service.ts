import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, ConfirmChannel, connect } from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';

const retryDelays = [5_000, 15_000, 30_000];
const notificationQueue = 'notification_queue';
const supportedEvents = new Set(['CustomerRegistered', 'ActivationEmailRequested', 'CustomerActivated', 'CustomerBlocked']);

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connecting?: Promise<void>;
  private timer?: NodeJS.Timeout;
  private sweepRunning = false;
  private readonly publishing = new Set<string>();

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
    this.timer = setInterval(() => void this.publishPending().catch((error) => this.logger.error('Falló el ciclo de publicación de la outbox', error)), 5_000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.channel?.close();
    await this.connection?.close();
  }

  async dispatch(eventId: string): Promise<void> {
    try {
      const event = await this.prisma.outboxEvent.findUnique({ where: { id: eventId } });
      if (event && !event.publishedAt && !event.failedAt && event.nextAttemptAt <= new Date()) await this.publish(event);
    } catch (error) {
      this.logger.warn(`El evento ${eventId} quedó pendiente en la outbox`, error);
    }
  }

  private async connect(): Promise<void> {
    if (this.channel) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const connection = await connect(this.config.getOrThrow<string>('RABBITMQ_URL'));
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(notificationQueue, { durable: true });
      connection.on('error', (error) => this.logger.warn('Error en la conexión RabbitMQ', error));
      connection.on('close', () => {
        if (this.connection === connection) {
          this.connection = undefined;
          this.channel = undefined;
        }
      });
      channel.on('error', (error) => this.logger.warn('Error en el canal RabbitMQ', error));
      channel.on('close', () => {
        if (this.channel === channel) this.channel = undefined;
      });
      this.connection = connection;
      this.channel = channel;
    })().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async publishPending(): Promise<void> {
    if (this.sweepRunning) return;
    this.sweepRunning = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { publishedAt: null, failedAt: null, attempts: { lte: retryDelays.length }, nextAttemptAt: { lte: new Date() } },
        orderBy: { occurredAt: 'asc' },
        take: 50,
      });
      for (const event of events) await this.publish(event);
    } finally {
      this.sweepRunning = false;
    }
  }

  private async publish(event: { id: string; eventType: string; correlationId: string; payload: unknown; occurredAt: Date; attempts: number }): Promise<void> {
    if (this.publishing.has(event.id)) return;
    this.publishing.add(event.id);
    try {
      if (!supportedEvents.has(event.eventType)) {
        await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { failedAt: new Date() } });
        this.logger.error(`Evento no soportado en la outbox: ${event.eventType}`);
        return;
      }
      if (!this.channel) await this.connect();
      const envelope = {
        eventId: event.id,
        eventType: event.eventType,
        eventVersion: 1,
        occurredAt: event.occurredAt.toISOString(),
        correlationId: event.correlationId,
        causationId: null,
        producer: 'customer-service',
        payload: event.payload,
      };
      const packet = { pattern: event.eventType, data: envelope };
      const content = Buffer.from(JSON.stringify(packet));
      this.channel!.sendToQueue(notificationQueue, content, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        correlationId: event.correlationId,
      });
      await this.channel!.waitForConfirms();
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date(), ...(event.eventType === 'ActivationEmailRequested' ? { payload: { redacted: true } } : {}) },
      });
    } catch (error) {
      const attempts = event.attempts + 1;
      const exhausted = attempts > retryDelays.length;
      if (exhausted) this.logger.error(`Evento ${event.id} agotó sus reintentos`);
      else this.logger.warn(`No se publicó ${event.id}; reintento ${attempts}/3`);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: exhausted
          ? { attempts, failedAt: new Date() }
          : { attempts, nextAttemptAt: new Date(Date.now() + retryDelays[attempts - 1]) },
      });
    } finally {
      this.publishing.delete(event.id);
    }
  }
}

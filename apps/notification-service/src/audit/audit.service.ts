import { Injectable, Logger } from '@nestjs/common';
import {
  createNotificationMetrics,
  getTraceContext,
} from '@bank-usac/observability';
import { PrismaService } from '../prisma/prisma.service.js';

// Mapa de clasificación: evento → severidad (Proyecto 2 - RF-NOT-02)
const EVENT_SEVERITY_MAP: Record<string, 'INFO' | 'WARNING' | 'ERROR'> = {
  // INFO: operaciones exitosas y de registro normal
  CustomerRegistered: 'INFO',
  CustomerActivated: 'INFO',
  KYCStatusUpdated: 'INFO',
  AccountCreated: 'INFO',
  TransferCompleted: 'INFO',
  TransferRequested: 'INFO',
  DestinationCredited: 'INFO',
  PaymentApproved: 'INFO',

  // WARNING: rechazos por reglas de negocio (no son errores del sistema)
  CustomerBlocked: 'WARNING',
  AccountAnomalyDetected: 'WARNING',
  SLOAlert: 'WARNING',
  FundsReservationRejected: 'WARNING',
  PaymentRejected: 'WARNING',
  KYCRejected: 'WARNING',
  MinimumBalanceViolated: 'WARNING',

  // ERROR: fallos técnicos o compensaciones de Saga
  DestinationCreditRejected: 'ERROR',
  PaymentTimeout: 'ERROR',
  TransferFailed: 'ERROR',
  FundsReleased: 'ERROR',
};

function resolveSeverity(
  eventType: string,
  payload?: Record<string, unknown>,
): 'INFO' | 'WARNING' | 'ERROR' {
  if (eventType === 'KYCStatusUpdated' && payload?.kycStatus === 'REJECTED') {
    return 'WARNING';
  }
  return EVENT_SEVERITY_MAP[eventType] ?? 'INFO';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly notificationMetrics = createNotificationMetrics('notification-service');

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(eventData: any, producer: string) {
    try {
      const eventId = eventData.eventId || crypto.randomUUID();
      const eventType = eventData.eventType || 'UnknownEvent';
      const correlationId = eventData.correlationId || 'NoCorrelation';
      const payload =
        eventData.payload && typeof eventData.payload === 'object'
          ? eventData.payload
          : {};
      const severity = resolveSeverity(eventType, payload);

      const record = await this.prisma.auditLog.upsert({
        where: { eventId },
        update: {}, // Idempotencia: si ya existe, no actualizamos
        create: {
          eventId,
          eventType,
          eventVersion: eventData.eventVersion || 1,
          correlationId,
          causationId: eventData.causationId,
          producer,
          payload,
          severity,
          traceId: getTraceContext()?.traceId ?? null,
          spanId: getTraceContext()?.spanId ?? null,
          occurredAt: eventData.occurredAt
            ? new Date(eventData.occurredAt)
            : new Date(),
        },
      });

      this.logger.log(
        `[Auditoría] [${severity}] Evento guardado: ${eventType} (ID: ${eventId})`,
      );
      return record;
    } catch (error) {
      this.logger.error(
        `Error al guardar auditoría para evento de ${producer}`,
        error,
      );
    }
  }

  async query(filters: {
    correlationId?: string;
    traceId?: string;
    producer?: string;
    severity?: 'INFO' | 'WARNING' | 'ERROR';
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        correlationId: filters.correlationId || undefined,
        traceId: filters.traceId || undefined,
        producer: filters.producer || undefined,
        severity: filters.severity || undefined,
      },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }

  async sendEmailNotification(to: string, subject: string, _message: string) {
    const startedAt = Date.now();
    // Este método conserva la notificación simulada de eventos de Payment.
    this.logger.log(`[Auditoría] Notificación registrada para: ${to} | ${subject}`);
    const attributes = { notification_type: 'payment', status: 'success' };
    this.notificationMetrics.total.add(1, attributes);
    this.notificationMetrics.duration.record(Date.now() - startedAt, attributes);
  }
}

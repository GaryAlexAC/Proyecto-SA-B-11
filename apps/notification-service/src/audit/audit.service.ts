import { Injectable, Logger } from '@nestjs/common';
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

function resolveSeverity(eventType: string): 'INFO' | 'WARNING' | 'ERROR' {
  return EVENT_SEVERITY_MAP[eventType] ?? 'INFO';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(eventData: any, producer: string) {
    try {
      const eventId = eventData.eventId || crypto.randomUUID();
      const eventType = eventData.eventType || 'UnknownEvent';
      const correlationId = eventData.correlationId || 'NoCorrelation';
      const severity = resolveSeverity(eventType);

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
          payload: eventData.payload || {},
          severity,
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

  async sendEmailNotification(to: string, subject: string, message: string) {
    // Este método se mantiene por compatibilidad pero los controllers
    // ahora usan EmailService directamente para envío real de correos.
    this.logger.log(`[Auditoría] Notificación registrada para: ${to} | ${subject}`);
  }
}

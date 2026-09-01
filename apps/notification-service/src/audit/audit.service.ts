import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(eventData: any, producer: string) {
    try {
      // Extraemos la metadata básica asegurando valores por defecto
      const eventId = eventData.eventId || crypto.randomUUID();
      const eventType = eventData.eventType || 'UnknownEvent';
      const correlationId = eventData.correlationId || 'NoCorrelation';
      
      const record = await this.prisma.auditLog.upsert({
        where: { eventId },
        update: {}, // Si ya existe (idempotencia), no actualizamos nada
        create: {
          eventId,
          eventType,
          eventVersion: eventData.eventVersion || 1,
          correlationId,
          causationId: eventData.causationId,
          producer,
          payload: eventData.payload || {},
          occurredAt: eventData.occurredAt ? new Date(eventData.occurredAt) : new Date(),
        },
      });

      this.logger.log(`[Auditoría] Evento guardado: ${eventType} (ID: ${eventId})`);
      return record;
    } catch (error) {
      this.logger.error(`Error al guardar auditoría para evento de ${producer}`, error);
    }
  }

  async sendEmailNotification(to: string, subject: string, message: string) {
    // Simulación del envío de correo según reglas de negocio
    this.logger.log(`\n======================================================`);
    this.logger.log(`📧 SIMULANDO ENVÍO DE CORREO...`);
    this.logger.log(`Para: ${to}`);
    this.logger.log(`Asunto: ${subject}`);
    this.logger.log(`Mensaje: ${message}`);
    this.logger.log(`======================================================\n`);
  }
}

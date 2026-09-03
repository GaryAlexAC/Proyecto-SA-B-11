import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from '../audit/audit.service.js';

@Controller()
export class PaymentEventsController {
  private readonly logger = new Logger(PaymentEventsController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern('PaymentApproved')
  async handlePaymentApproved(@Payload() data: any) {
    this.logger.log(`Recibido evento PaymentApproved: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'payment-service');

    // Simular correo (RF-NOT-03)
    const email = data.payload?.email || 'cliente@banco.com';
    const amount = data.payload?.amount || 0;

    await this.auditService.sendEmailNotification(
      email,
      'Pago Aprobado - Bank USAC',
      `Su pago por el monto de Q${amount} se ha aprobado exitosamente.`,
    );
  }

  @EventPattern('PaymentRejected')
  async handlePaymentRejected(@Payload() data: any) {
    this.logger.log(`Recibido evento PaymentRejected: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'payment-service');

    // Simular correo (RF-NOT-03)
    const email = data.payload?.email || 'cliente@banco.com';
    const reason = data.payload?.reason || 'Fondos insuficientes';

    await this.auditService.sendEmailNotification(
      email,
      'Pago Rechazado - Bank USAC',
      `Su pago ha sido rechazado. Motivo: ${reason}`,
    );
  }
}

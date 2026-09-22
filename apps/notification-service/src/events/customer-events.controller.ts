import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../email/email.service.js';

@Controller()
export class CustomerEventsController {
  private readonly logger = new Logger(CustomerEventsController.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @EventPattern('CustomerRegistered')
  async handleCustomerRegistered(@Payload() data: any) {
    this.logger.log(`Recibido evento CustomerRegistered: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'customer-service');
  }

  @EventPattern('ActivationEmailRequested')
  async handleActivationEmailRequested(@Payload() data: any) {
    this.logger.log(
      `Recibido evento ActivationEmailRequested: ${data.eventId}`,
    );
    await this.auditService.recordEvent(data, 'customer-service');

    const email = data.payload?.email || 'usuario@banco.com';
    const link = data.payload?.activationLink || 'http://localhost/activar';

    // Envío real de correo con Nodemailer (RF-NOT-01)
    await this.emailService.sendActivationEmail(email, link);
  }

  @EventPattern('CustomerActivated')
  async handleCustomerActivated(@Payload() data: any) {
    this.logger.log(`Recibido evento CustomerActivated: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'customer-service');
  }

  @EventPattern('CustomerBlocked')
  async handleCustomerBlocked(@Payload() data: any) {
    this.logger.log(`Recibido evento CustomerBlocked: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'customer-service');
  }
}

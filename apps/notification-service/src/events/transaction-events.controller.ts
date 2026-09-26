import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../email/email.service.js';

@Controller()
export class TransactionEventsController {
  private readonly logger = new Logger(TransactionEventsController.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @EventPattern('TransferRequested')
  async handleTransferRequested(@Payload() data: any) {
    this.logger.log(`Recibido evento TransferRequested: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');
  }

  @EventPattern('TransferCompleted')
  async handleTransferCompleted(@Payload() data: any) {
    this.logger.log(`[INFO] Recibido evento TransferCompleted: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');

    const email = data.payload?.email || 'cliente@banco.com';
    const amount = data.payload?.amount || data.amount || 0;
    const correlationId = data.correlationId || '';

    await this.emailService.sendTransferNotification(email, amount, 'COMPLETED', correlationId);
  }

  @EventPattern('TransferFailed')
  async handleTransferFailed(@Payload() data: any) {
    this.logger.log(`[ERROR] Recibido evento TransferFailed: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');

    const email = data.payload?.email || 'cliente@banco.com';
    const amount = data.payload?.amount || data.amount || 0;
    const correlationId = data.correlationId || '';

    await this.emailService.sendTransferNotification(email, amount, 'FAILED', correlationId);
  }

  // Nuevo evento Proyecto 2: timeout en payment-service → severidad ERROR
  @EventPattern('PaymentTimeout')
  async handlePaymentTimeout(@Payload() data: any) {
    this.logger.error(
      `[ERROR] Recibido evento PaymentTimeout: correlationId=${data.correlationId}`,
    );
    await this.auditService.recordEvent(
      { ...data, eventType: 'PaymentTimeout' },
      'payment-service',
    );
  }
}

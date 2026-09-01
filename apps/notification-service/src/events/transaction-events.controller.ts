import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from '../audit/audit.service';

@Controller()
export class TransactionEventsController {
  private readonly logger = new Logger(TransactionEventsController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern('TransferRequested')
  async handleTransferRequested(@Payload() data: any) {
    this.logger.log(`Recibido evento TransferRequested: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');
  }

  @EventPattern('TransferCompleted')
  async handleTransferCompleted(@Payload() data: any) {
    this.logger.log(`Recibido evento TransferCompleted: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');

    // Simular correo (RF-NOT-02)
    const email = data.payload?.email || 'cliente@banco.com';
    const amount = data.payload?.amount || 0;
    
    await this.auditService.sendEmailNotification(
      email,
      'Transferencia Exitosa - Bank USAC',
      `Su transferencia por el monto de Q${amount} se ha completado correctamente.`
    );
  }

  @EventPattern('TransferFailed')
  async handleTransferFailed(@Payload() data: any) {
    this.logger.log(`Recibido evento TransferFailed: ${data.eventId}`);
    await this.auditService.recordEvent(data, 'transaction-service');

    // Simular correo (RF-NOT-02)
    const email = data.payload?.email || 'cliente@banco.com';
    const reason = data.payload?.reason || 'Error en validación';
    
    await this.auditService.sendEmailNotification(
      email,
      'Transferencia Fallida - Bank USAC',
      `Su transferencia no pudo ser completada. Motivo: ${reason}`
    );
  }
}

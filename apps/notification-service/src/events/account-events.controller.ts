import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuditService } from '../audit/audit.service.js';

@Controller()
export class AccountEventsController {
  private readonly logger = new Logger(AccountEventsController.name);

  constructor(private readonly auditService: AuditService) {}

  @EventPattern('AccountAnomalyDetected')
  async handleAccountAnomaly(@Payload() data: Record<string, unknown>) {
    this.logger.warn(
      `Account anomaly detected for correlationId=${String(data.correlationId ?? '')}`,
    );
    return this.auditService.recordEvent(
      { ...data, eventType: 'AccountAnomalyDetected' },
      'account-service',
    );
  }
}

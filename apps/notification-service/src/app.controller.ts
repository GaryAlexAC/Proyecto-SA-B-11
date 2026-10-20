import { Controller, Get } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service.js';
import { AuditService } from './audit/audit.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern('query_audit_logs')
  queryAuditLogs(
    @Payload()
    filters: {
      correlationId?: string;
      traceId?: string;
      producer?: string;
      severity?: 'INFO' | 'WARNING' | 'ERROR';
    },
  ) {
    return this.auditService.query(filters ?? {});
  }

  @EventPattern('SLOAlert')
  recordSloAlert(@Payload() data: Record<string, unknown>) {
    return this.auditService.recordEvent(data, 'alertmanager');
  }
}

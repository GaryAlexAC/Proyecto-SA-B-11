import { Controller, Get, Headers, Inject, Query, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/audit')
export class AuditController {
  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Get()
  query(
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Query('correlationId') correlationId?: string,
    @Query('traceId') traceId?: string,
    @Query('producer') producer?: string,
    @Query('severity') severity?: 'INFO' | 'WARNING' | 'ERROR',
  ) {
    return rpcToHttp(
      this.client.send('query_audit_logs', {
        authorization,
        correlationId,
        traceId,
        producer,
        severity,
        requestCorrelationId: request.correlationId,
      }),
      'Notification & Audit Service',
    );
  }
}

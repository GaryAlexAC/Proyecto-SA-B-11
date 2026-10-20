import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('api/alerts')
export class AlertController {
  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post('webhook')
  receive(@Body() alert: Record<string, unknown>) {
    this.client.emit('SLOAlert', {
      eventId: `alert:${Date.now()}`,
      eventType: 'SLOAlert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      correlationId: String(alert.groupKey ?? `alert-${Date.now()}`),
      producer: 'alertmanager',
      payload: alert,
    });
    return { accepted: true };
  }
}

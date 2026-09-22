import { Module } from '@nestjs/common';
import { CustomerEventsController } from './customer-events.controller.js';
import { TransactionEventsController } from './transaction-events.controller.js';
import { PaymentEventsController } from './payment-events.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [AuditModule, EmailModule],
  controllers: [
    CustomerEventsController,
    TransactionEventsController,
    PaymentEventsController,
  ],
})
export class EventsModule {}

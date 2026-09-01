import { Module } from '@nestjs/common';
import { CustomerEventsController } from './customer-events.controller';
import { TransactionEventsController } from './transaction-events.controller';
import { PaymentEventsController } from './payment-events.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [
    CustomerEventsController,
    TransactionEventsController,
    PaymentEventsController,
  ],
})
export class EventsModule {}

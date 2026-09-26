import { Module } from '@nestjs/common';
import { AccountEventsController } from './account-events.controller.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { CustomerEventsController } from './customer-events.controller.js';

@Module({
  imports: [TransactionsModule],
  controllers: [AccountEventsController, CustomerEventsController],
})
export class EventsModule {}

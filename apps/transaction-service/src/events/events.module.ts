import { Module } from '@nestjs/common';
import { AccountEventsController } from './account-events.controller.js';
import { TransactionsModule } from '../transactions/transactions.module.js';

@Module({
  imports: [TransactionsModule],
  controllers: [AccountEventsController],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { TransferEventsController } from './transfer-events.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';

@Module({
  imports: [AccountsModule],
  controllers: [TransferEventsController],
})
export class EventsModule {}
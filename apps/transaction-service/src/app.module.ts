import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [PrismaModule, MessagingModule, TransactionsModule, EventsModule],
})
export class AppModule {}

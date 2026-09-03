import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { EventsModule } from './events/events.module.js';

@Module({
  imports: [PrismaModule, TransactionsModule, EventsModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { EventsModule } from './events/events.module.js';
import { MessagingModule } from './messaging/messaging.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AccountsModule,
    EventsModule,
    MessagingModule,
  ],
})
export class AppModule {}

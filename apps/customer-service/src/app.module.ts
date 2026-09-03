import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { HealthController } from './health.controller.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, MessagingModule, AuthModule, CustomersModule],
  controllers: [HealthController],
})
export class AppModule {}

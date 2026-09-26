import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { PaymentsModule } from './payments/payments.module.js';

@Module({
  imports: [PrismaModule, PaymentsModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from '../modules/customer/auth/auth.module';
import { CustomersModule } from '../modules/customer/customers.module';
import { MessagingModule } from '../infrastructure/messaging/messaging.module';
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { HealthController } from '../presentation/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().port().default(3001),
        DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        RABBITMQ_URL: Joi.string().uri({ scheme: ['amqp', 'amqps'] }).required(),
        ACTIVATION_URL_BASE: Joi.string().uri().required(),
      }),
    }),
    PrismaModule,
    MessagingModule,
    CustomersModule,
    AuthModule,
  ],
})
export class AppModule {}

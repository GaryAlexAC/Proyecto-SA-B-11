import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';
import { ClientsModule, Transport } from '@nestjs/microservices';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

@Module({
  imports: [
    JwtModule.register({ secret: jwtSecret }),
    ClientsModule.register([
      {
        name: 'ACCOUNT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'account_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'notification_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [TransactionsService, JwtAuthService],
  controllers: [TransactionsController],
  exports: [TransactionsService, ClientsModule],
})
export class TransactionsModule {}

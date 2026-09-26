import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
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
        name: 'TRANSACTION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'transaction_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [PaymentsService, JwtAuthService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}

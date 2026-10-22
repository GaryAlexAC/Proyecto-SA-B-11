import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { InterbankService } from '../interbank/interbank.service.js';
import { InterbankController } from '../interbank/interbank.controller.js';
import { ClientsModule, Transport } from '@nestjs/microservices';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

const rmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

@Module({
  imports: [
    JwtModule.register({ secret: jwtSecret }),
    ClientsModule.register([
      {
        name: 'TRANSACTION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [rmqUrl],
          queue: 'transaction_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'ACCOUNT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [rmqUrl],
          queue: 'account_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  providers: [PaymentsService, JwtAuthService, InterbankService],
  controllers: [PaymentsController, InterbankController],
  exports: [PaymentsService, InterbankService],
})
export class PaymentsModule {}

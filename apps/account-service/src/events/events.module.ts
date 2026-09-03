import { Module } from '@nestjs/common';
import { TransferEventsController } from './transfer-events.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    AccountsModule,
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
  controllers: [TransferEventsController],
})
export class EventsModule {}

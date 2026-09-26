import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MessagingService } from './messaging.service.js';

const rmqClient = (name: string, queue: string) => ({
  name,
  transport: Transport.RMQ as const,
  options: {
    urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
    queue,
    queueOptions: { durable: true },
    persistent: true,
  },
});

@Global()
@Module({
  imports: [
    ClientsModule.register([
      rmqClient('ACCOUNT_SERVICE', 'account_queue'),
      rmqClient('CUSTOMER_SERVICE', 'customer_queue'),
      rmqClient('NOTIFICATION_SERVICE', 'notification_queue'),
      rmqClient('PAYMENT_SERVICE', 'payment_queue'),
    ]),
  ],
  providers: [MessagingService],
  exports: [MessagingService, ClientsModule],
})
export class MessagingModule {}
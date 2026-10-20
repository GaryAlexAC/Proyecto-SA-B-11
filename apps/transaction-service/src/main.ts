import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  BrokerTraceInterceptor,
  startObservability,
  StructuredLogger,
} from '@bank-usac/observability';

async function bootstrap() {
  await startObservability('transaction-service');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'transaction_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );
  app.useLogger(new StructuredLogger('transaction-service'));
  app.useGlobalInterceptors(new BrokerTraceInterceptor('transaction-service'));
  await app.listen();
}
bootstrap();

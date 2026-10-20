import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  BrokerTraceInterceptor,
  startObservability,
  StructuredLogger,
} from '@bank-usac/observability';

async function bootstrap() {
  await startObservability('payment-service');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'payment_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );
  app.useLogger(new StructuredLogger('payment-service'));
  app.useGlobalInterceptors(new BrokerTraceInterceptor('payment-service'));
  await app.listen();
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  BrokerTraceInterceptor,
  startObservability,
  StructuredLogger,
} from '@bank-usac/observability';

async function bootstrap() {
  await startObservability('notification-service');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        // FIX P6: use env variable instead of hardcoded localhost
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'notification_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );
  app.useLogger(new StructuredLogger('notification-service'));
  app.useGlobalInterceptors(new BrokerTraceInterceptor('notification-service'));
  await app.listen();
}
bootstrap();

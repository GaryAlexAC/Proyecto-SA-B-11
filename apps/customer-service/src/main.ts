import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  BrokerTraceInterceptor,
  startObservability,
  StructuredLogger,
} from '@bank-usac/observability';
import { AppModule } from './app.module.js';

async function bootstrap() {
  await startObservability('customer-service');
  const app = await NestFactory.create(AppModule);
  app.useLogger(new StructuredLogger('customer-service'));
  app.useGlobalInterceptors(new BrokerTraceInterceptor('customer-service'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'customer_queue',
        queueOptions: { durable: true },
      },
    },
    { inheritAppConfig: true },
  );

  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
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
  await app.listen();
  console.log('🚀 Notification Service está escuchando en RabbitMQ');
}
bootstrap();

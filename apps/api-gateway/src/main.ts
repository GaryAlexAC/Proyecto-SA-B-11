import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { correlationIdMiddleware } from './request-context.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(correlationIdMiddleware);

  // Enable CORS so the frontend (React) can call the Gateway from the browser
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization,X-Correlation-Id,Idempotency-Key',
    exposedHeaders: 'X-Correlation-Id',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 API Gateway corriendo en el puerto ${process.env.PORT ?? 3000}`,
  );
}
await bootstrap();

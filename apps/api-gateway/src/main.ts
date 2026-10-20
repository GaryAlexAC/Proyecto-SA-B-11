import { NestFactory } from '@nestjs/core';
import {
  HttpMetricsInterceptor,
  HttpTraceInterceptor,
  startObservability,
  StructuredLogger,
} from '@bank-usac/observability';
import { AppModule } from './app.module.js';
import { correlationIdMiddleware } from './request-context.js';

async function bootstrap() {
  await startObservability('api-gateway');
  const app = await NestFactory.create(AppModule);
  app.useLogger(new StructuredLogger('api-gateway'));
  app.useGlobalInterceptors(new HttpTraceInterceptor());
  app.useGlobalInterceptors(new HttpMetricsInterceptor());
  app.use(correlationIdMiddleware);

  // Enable CORS so the frontend (React) can call the Gateway from the browser
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization,X-Correlation-Id,Idempotency-Key',
    exposedHeaders: 'X-Correlation-Id,X-Trace-Id',
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

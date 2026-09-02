import { ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Errors, ValidationDetail } from '../common/application/errors/app-error';
import { AppExceptionFilter } from '../common/presentation/filters/app-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => Errors.validation(validationDetails(errors)),
  }));
  app.enableShutdownHooks();
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL!],
      queue: 'customer_queue',
      queueOptions: { durable: true },
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}

function validationDetails(errors: ValidationError[], parent = ''): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownDetails = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...ownDetails, ...validationDetails(error.children ?? [], field)];
  });
}

void bootstrap();

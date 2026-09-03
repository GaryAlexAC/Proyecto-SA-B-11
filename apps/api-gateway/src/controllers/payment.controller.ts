import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const SERVICE_TIMEOUT_MS = 8000;

@Controller('api/payments')
export class PaymentController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createPayment(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_payment', payload).pipe(
      timeout(SERVICE_TIMEOUT_MS),
      catchError(() =>
        throwError(
          () =>
            new HttpException(
              'Payment Service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        ),
      ),
    );
  }

  @Get(':id')
  getPaymentStatus(@Param('id') id: string) {
    return this.client
      .send('get_payment', { id, correlationId: uuidv4() })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Payment Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }
}

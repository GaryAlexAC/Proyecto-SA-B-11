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

// FIX BUG #4: added timeout and error handling for all endpoints
const SERVICE_TIMEOUT_MS = 8000;

@Controller('api/transactions')
export class TransactionController {
  constructor(
    @Inject('TRANSACTION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createTransaction(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_transaction', payload).pipe(
      timeout(SERVICE_TIMEOUT_MS),
      catchError(() =>
        throwError(
          () =>
            new HttpException(
              'Transaction Service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        ),
      ),
    );
  }

  @Get(':id')
  getTransactionStatus(@Param('id') id: string) {
    return this.client
      .send('get_transaction', { id, correlationId: uuidv4() })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Transaction Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }

  @Get('customer/:customerId')
  getTransactionsByCustomer(@Param('customerId') customerId: string) {
    return this.client
      .send('get_transactions_by_customer', {
        customerId,
        correlationId: uuidv4(),
      })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Transaction Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }
}

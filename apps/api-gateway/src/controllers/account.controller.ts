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

@Controller('api/accounts')
export class AccountController {
  constructor(
    @Inject('ACCOUNT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createAccount(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_account', payload).pipe(
      timeout(SERVICE_TIMEOUT_MS),
      catchError(() =>
        throwError(
          () =>
            new HttpException(
              'Account Service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        ),
      ),
    );
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.client
      .send('get_balance', { id, correlationId: uuidv4() })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Account Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }

  @Get('customer/:customerId')
  getAccountsByCustomer(@Param('customerId') customerId: string) {
    return this.client
      .send('get_accounts_by_customer', { customerId, correlationId: uuidv4() })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Account Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }
}

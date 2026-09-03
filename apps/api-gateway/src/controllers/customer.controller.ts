import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { timeout, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

const SERVICE_TIMEOUT_MS = 8000;

@Controller('api/customers')
export class CustomerController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  registerCustomer(@Body() data: any) {
    // Inyectamos correlationId para trazabilidad (RNF-07)
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('register_customer', payload).pipe(
      timeout(SERVICE_TIMEOUT_MS),
      catchError(() =>
        throwError(
          () =>
            new HttpException(
              'Customer Service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        ),
      ),
    );
  }

  @Get(':id')
  getCustomer(@Param('id') id: string) {
    return this.client
      .send('get_customer', { id, correlationId: uuidv4() })
      .pipe(
        timeout(SERVICE_TIMEOUT_MS),
        catchError(() =>
          throwError(
            () =>
              new HttpException(
                'Customer Service no disponible',
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          ),
        ),
      );
  }

  @Put(':id')
  updateCustomer(@Param('id') id: string, @Body() data: any) {
    const payload = { id, ...data, correlationId: uuidv4() };
    return this.client.send('update_customer', payload).pipe(
      timeout(SERVICE_TIMEOUT_MS),
      catchError(() =>
        throwError(
          () =>
            new HttpException(
              'Customer Service no disponible',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
        ),
      ),
    );
  }
}

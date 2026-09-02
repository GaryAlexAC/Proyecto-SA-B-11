import { Body, Controller, Headers, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/cashiers')
export class CashierController {
  constructor(@Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  createCashier(@Body() data: Record<string, unknown>, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    return rpcToHttp(this.client.send('create_cashier', { data, authorization, idempotencyKey, correlationId: uuidv4() }));
  }
}

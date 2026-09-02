import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/accounts')
export class AccountController {
  constructor(
    @Inject('ACCOUNT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createAccount(@Body() data: any, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    const payload = { ...data, authorization, idempotencyKey, correlationId: uuidv4() };
    return rpcToHttp(this.client.send('create_account', payload));
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_balance', { id, authorization, correlationId: uuidv4() }));
  }

  @Get('customer/:customerId')
  getAccountsByCustomer(@Param('customerId') customerId: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_accounts_by_customer', { customerId, authorization, correlationId: uuidv4() }));
  }
}

import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/transactions')
export class TransactionController {
  constructor(
    @Inject('TRANSACTION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createTransaction(@Body() data: any, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    const payload = { ...data, authorization, idempotencyKey, correlationId: uuidv4() };
    return rpcToHttp(this.client.send('create_transaction', payload));
  }

  @Get(':id')
  getTransactionStatus(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_transaction', { id, authorization, correlationId: uuidv4() }));
  }

  @Get('customer/:customerId')
  getTransactionsByCustomer(@Param('customerId') customerId: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_transactions_by_customer', { customerId, authorization, correlationId: uuidv4() }));
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/transactions')
export class TransactionController {
  constructor(
    @Inject('TRANSACTION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createTransaction(
    @Body() data: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.client.send('create_transaction', {
        ...data,
        authorization,
        idempotencyKey,
        correlationId: request.correlationId,
      }),
      'Transaction Service',
    );
  }

  @Get(':id')
  getTransactionStatus(
    @Param('id') id: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_transaction', {
        id,
        authorization,
        correlationId: request.correlationId,
      }),
      'Transaction Service',
    );
  }

  @Get('customer/:customerId')
  getTransactionsByCustomer(
    @Param('customerId') customerId: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_transactions_by_customer', {
        customerId,
        authorization,
        accountId,
        status,
        from,
        to,
        correlationId: request.correlationId,
      }),
      'Transaction Service',
    );
  }
}

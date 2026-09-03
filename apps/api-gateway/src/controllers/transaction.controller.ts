import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
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
  ) {
    return rpcToHttp(
      this.client.send('create_transaction', {
        ...data,
        authorization,
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
  ) {
    return rpcToHttp(
      this.client.send('get_transactions_by_customer', {
        customerId,
        authorization,
        correlationId: request.correlationId,
      }),
      'Transaction Service',
    );
  }
}

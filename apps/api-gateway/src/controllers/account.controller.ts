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

@Controller('api/accounts')
export class AccountController {
  constructor(
    @Inject('ACCOUNT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createAccount(
    @Body() data: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('create_account', {
        ...data,
        authorization,
        correlationId: request.correlationId,
      }),
      'Account Service',
    );
  }

  @Get(':id/balance')
  getBalance(
    @Param('id') id: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_balance', {
        id,
        authorization,
        correlationId: request.correlationId,
      }),
      'Account Service',
    );
  }

  @Get('customer/:customerId')
  getAccountsByCustomer(
    @Param('customerId') customerId: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_accounts_by_customer', {
        customerId,
        authorization,
        correlationId: request.correlationId,
      }),
      'Account Service',
    );
  }
}

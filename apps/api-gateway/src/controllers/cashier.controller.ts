import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/cashiers')
export class CashierController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientProxy,
  ) {}

  @Post()
  createCashier(
    @Body() customer: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.customerClient.send('create_cashier', {
        customer,
        authorization,
        correlationId: request.correlationId,
        idempotencyKey,
      }),
    );
  }
}

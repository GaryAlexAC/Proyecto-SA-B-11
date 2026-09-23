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

@Controller('api/payments')
export class PaymentController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createPayment(
    @Body() data: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.client.send('create_payment', {
        ...data,
        authorization,
        idempotencyKey,
        correlationId: request.correlationId,
      }),
      'Payment Service',
    );
  }

  @Get('services')
  getServices(
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_services', {
        authorization,
        correlationId: request.correlationId,
      }),
      'Payment Service',
    );
  }

  @Get(':id')
  getPaymentStatus(
    @Param('id') id: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_payment', {
        id,
        authorization,
        correlationId: request.correlationId,
      }),
      'Payment Service',
    );
  }
}

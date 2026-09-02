import { Body, Controller, Get, Headers, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/payments')
export class PaymentController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createPayment(@Body() data: any, @Headers('authorization') authorization?: string, @Headers('idempotency-key') idempotencyKey?: string) {
    const payload = { ...data, authorization, idempotencyKey, correlationId: uuidv4() };
    return rpcToHttp(this.client.send('create_payment', payload));
  }

  @Get(':id')
  getPaymentStatus(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return rpcToHttp(this.client.send('get_payment', { id, authorization, correlationId: uuidv4() }));
  }
}

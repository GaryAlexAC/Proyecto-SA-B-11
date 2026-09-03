import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/payments')
export class PaymentController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createPayment(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_payment', payload);
  }

  @Get(':id')
  getPaymentStatus(@Param('id') id: string) {
    return this.client.send('get_payment', { id, correlationId: uuidv4() });
  }
}

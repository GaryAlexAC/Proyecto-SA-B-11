import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/transactions')
export class TransactionController {
  constructor(
    @Inject('TRANSACTION_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createTransaction(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_transaction', payload);
  }

  @Get(':id')
  getTransactionStatus(@Param('id') id: string) {
    return this.client.send('get_transaction', { id, correlationId: uuidv4() });
  }

  @Get('customer/:customerId')
  getTransactionsByCustomer(@Param('customerId') customerId: string) {
    return this.client.send('get_transactions_by_customer', {
      customerId,
      correlationId: uuidv4(),
    });
  }
}

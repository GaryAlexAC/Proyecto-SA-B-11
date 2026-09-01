import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/accounts')
export class AccountController {
  constructor(
    @Inject('ACCOUNT_SERVICE') private readonly client: ClientProxy,
  ) {}

  @Post()
  createAccount(@Body() data: any) {
    const payload = { ...data, correlationId: uuidv4() };
    return this.client.send('create_account', payload);
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.client.send('get_balance', { id, correlationId: uuidv4() });
  }

  @Get('customer/:customerId')
  getAccountsByCustomer(@Param('customerId') customerId: string) {
    return this.client.send('get_accounts_by_customer', { customerId, correlationId: uuidv4() });
  }
}

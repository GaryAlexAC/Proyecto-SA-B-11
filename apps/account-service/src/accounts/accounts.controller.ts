import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AccountsService } from './accounts.service.js';

@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @MessagePattern('create_account')
  async createAccount(@Payload() data: any) {
    return this.accountsService.createAccount(data);
  }

  @MessagePattern('get_balance')
  async getBalance(@Payload() data: { id: string; correlationId: string }) {
    return this.accountsService.getBalance(data.id);
  }

  @MessagePattern('get_accounts_by_customer')
  async getAccountsByCustomer(
    @Payload() data: { customerId: string; correlationId: string },
  ) {
    return this.accountsService.getAccountsByCustomer(data.customerId);
  }
}

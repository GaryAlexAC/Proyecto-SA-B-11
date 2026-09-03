import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { AccountsService } from './accounts.service.js';

interface AuthorizedMessage {
  authorization?: string;
  correlationId: string;
}

@Controller()
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  @MessagePattern('create_account')
  async createAccount(@Payload() data: any) {
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER']);
    return this.accountsService.createAccount(data);
  }

  @MessagePattern('get_balance')
  async getBalance(@Payload() data: AuthorizedMessage & { id: string }) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'ADMIN',
      'CASHIER',
      'CLIENT',
    ]);
    return this.accountsService.getBalance(
      data.id,
      actor.role === 'CLIENT' ? actor.customerId : undefined,
    );
  }

  @MessagePattern('get_accounts_by_customer')
  async getAccountsByCustomer(
    @Payload() data: AuthorizedMessage & { customerId: string },
  ) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'ADMIN',
      'CASHIER',
      'CLIENT',
    ]);
    this.jwtAuth.assertCustomerAccess(actor, data.customerId);
    return this.accountsService.getAccountsByCustomer(data.customerId);
  }
}

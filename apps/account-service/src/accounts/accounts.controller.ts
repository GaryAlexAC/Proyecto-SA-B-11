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
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'ADMIN']);
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

  @MessagePattern('get_account')
  async getAccount(@Payload() data: { id: string }) {
    return this.accountsService.getAccount(data.id);
  }

  @MessagePattern('interbank_credit')
  async interbankCredit(
    @Payload()
    data: {
      targetAccountId: string;
      amount: number;
      correlationId: string;
      eventId: string;
    },
  ) {
    return this.accountsService.applyCredit(
      'INTERBANK',
      data.targetAccountId,
      data.amount,
      data.correlationId,
      data.eventId,
    );
  }

  @MessagePattern('interbank_reserve')
  async interbankReserve(
    @Payload()
    data: {
      sourceAccountId: string;
      amount: number;
      correlationId: string;
      eventId: string;
      customerId: string;
    },
  ) {
    return this.accountsService.reserveFunds(
      data.sourceAccountId,
      null,
      data.amount,
      data.correlationId,
      data.eventId,
      data.customerId,
    );
  }

  @MessagePattern('interbank_refund')
  async interbankRefund(
    @Payload()
    data: {
      sourceAccountId: string;
      amount: number;
      correlationId: string;
      eventId: string;
      reason?: string;
    },
  ) {
    return this.accountsService.refundFunds(
      data.sourceAccountId,
      null,
      data.amount,
      data.correlationId,
      data.eventId,
      data.reason,
    );
  }
}

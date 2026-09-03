import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { TransactionsService } from './transactions.service.js';

interface AuthorizedMessage {
  authorization?: string;
  correlationId: string;
}

@Controller()
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  @MessagePattern('create_transaction')
  async createTransaction(@Payload() data: any) {
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'CLIENT']);
    return this.transactionsService.createTransaction(data);
  }

  @MessagePattern('get_transaction')
  async getTransaction(@Payload() data: AuthorizedMessage & { id: string }) {
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'CLIENT']);
    return this.transactionsService.getTransaction(data.id);
  }

  // FIX P5: handler was missing — Gateway exposes GET /api/transactions/customer/:customerId
  @MessagePattern('get_transactions_by_customer')
  async getTransactionsByCustomer(
    @Payload() data: AuthorizedMessage & { customerId: string },
  ) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
    ]);
    this.jwtAuth.assertCustomerAccess(actor, data.customerId);
    return this.transactionsService.getTransactionsByCustomer(
      data.customerId,
      data.authorization,
      data.correlationId,
    );
  }
}

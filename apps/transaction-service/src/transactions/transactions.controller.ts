import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TransactionsService } from './transactions.service.js';

@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @MessagePattern('create_transaction')
  async createTransaction(@Payload() data: any) {
    return this.transactionsService.createTransaction(data);
  }

  @MessagePattern('get_transaction')
  async getTransaction(@Payload() data: { id: string; correlationId: string }) {
    return this.transactionsService.getTransaction(data.id);
  }

  // FIX P5: handler was missing — Gateway exposes GET /api/transactions/customer/:customerId
  @MessagePattern('get_transactions_by_customer')
  async getTransactionsByCustomer(
    @Payload() data: { customerId: string; correlationId: string },
  ) {
    return this.transactionsService.getTransactionsByCustomer(data.customerId);
  }
}

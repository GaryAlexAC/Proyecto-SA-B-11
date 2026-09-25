import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  AuthenticatedUser,
  JwtAuthService,
} from '../auth/jwt-auth.service.js';
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
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
      'ADMIN'
    ]);
    return this.transactionsService.createTransaction(
      data,
      this.creationContext(data, actor),
    );
  }

  @MessagePattern('create_payment_transaction')
  async createPaymentTransaction(@Payload() data: any) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
    ]);
    return this.transactionsService.createPaymentTransaction(
      data,
      this.creationContext(data, actor),
    );
  }

  @MessagePattern('get_transaction')
  async getTransaction(@Payload() data: AuthorizedMessage & { id: string }) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
      'ADMIN'
    ]);
    return this.transactionsService.getTransaction(data.id, actor);
  }

  // FIX P5: handler was missing — Gateway exposes GET /api/transactions/customer/:customerId
  @MessagePattern('get_transactions_by_customer')
  async getTransactionsByCustomer(
    @Payload()
    data: AuthorizedMessage & {
      customerId: string;
      accountId?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
      'ADMIN'
    ]);
    this.jwtAuth.assertCustomerAccess(actor, data.customerId);
    return this.transactionsService.getTransactionsByCustomer(
      data.customerId,
      data.authorization,
      data.correlationId,
      {
        accountId: data.accountId,
        status: data.status,
        from: data.from,
        to: data.to,
      },
    );
  }

  private creationContext(data: any, actor: AuthenticatedUser) {
    const customerId =
      actor.role === 'CLIENT'
        ? actor.customerId
        : typeof data.customerId === 'string'
          ? data.customerId.trim()
          : '';
    if (!customerId) {
      throw new RpcException({
        statusCode: 400,
        error: 'customerId del titular es obligatorio para operaciones de cajero',
      });
    }

let idempotencyKey: string | undefined;
    if (typeof data.idempotencyKey === 'string') {
      const trimmed = data.idempotencyKey.trim();
      if (!trimmed) {
        throw new RpcException({
          statusCode: 400,
          error: 'Idempotency-Key no puede estar vacía',
        });
      }
      if (trimmed.length > 100) {
        throw new RpcException({
          statusCode: 400,
          error: 'Idempotency-Key no puede superar 100 caracteres',
        });
      }
      idempotencyKey = trimmed;
    }

    return {
      customerId,
      initiatedBy: actor.customerId,
      initiatorRole: actor.role,
      idempotencyKey,
    };
  }
}

import { Controller } from '@nestjs/common';
import {
  EventPattern,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { JwtAuthService } from '../auth/jwt-auth.service.js';
import { PaymentsService } from './payments.service.js';

interface AuthorizedMessage {
  authorization?: string;
  correlationId: string;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  @MessagePattern('create_payment')
  async createPayment(@Payload() data: any) {
    const actor = await this.jwtAuth.authenticate(data.authorization, [
      'CASHIER',
      'CLIENT',
    ]);
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
    return this.paymentsService.createPayment({
      ...data,
      customerId,
      initiatedBy: actor.customerId,
      initiatorRole: actor.role,
    });
  }

  @MessagePattern('get_payment')
  async getPayment(@Payload() data: AuthorizedMessage & { id: string }) {
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'CLIENT']);
    return this.paymentsService.getPayment(data.id);
  }

  @MessagePattern('get_services')
  async getServices(@Payload() data: AuthorizedMessage) {
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'CLIENT']);
    return this.paymentsService.getServices();
  }

@EventPattern('PaymentTransactionCompleted')
  async handlePaymentTransactionCompleted(@Payload() data: any) {
    return this.paymentsService.completePayment(
      data.correlationId,
      data.eventId,
    );
  }

  @EventPattern('PaymentTransactionFailed')
  async handlePaymentTransactionFailed(@Payload() data: any) {
    const reason =
      data.payload?.reason ?? data.reason ?? 'No fue posible completar el pago';
    return this.paymentsService.failPayment(
      data.correlationId,
      reason,
      data.eventId,
    );
  }
}

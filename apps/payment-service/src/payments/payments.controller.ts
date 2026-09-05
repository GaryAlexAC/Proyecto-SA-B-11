import { Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
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
    await this.jwtAuth.authenticate(data.authorization, ['CASHIER', 'CLIENT']);
    return this.paymentsService.createPayment(data);
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
    return this.paymentsService.completePayment(data.correlationId, data.eventId);
  }

  @EventPattern('PaymentTransactionFailed')
  async handlePaymentTransactionFailed(@Payload() data: any) {
    return this.paymentsService.failPayment(
      data.correlationId,
      data.reason || 'No fue posible completar el pago',
      data.eventId,
    );
  }
}

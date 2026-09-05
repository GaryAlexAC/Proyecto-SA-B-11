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

  @EventPattern('TransferCompleted')
  async handleTransferCompleted(@Payload() data: any) {
    // Evento emitido asíncronamente por el transaction-service al finalizar la saga.
    // No requiere JWT authorization.
    return this.paymentsService.createPayment(data);
  }
}

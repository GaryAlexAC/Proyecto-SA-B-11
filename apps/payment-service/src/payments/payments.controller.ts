import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentsService } from './payments.service.js';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern('create_payment')
  async createPayment(@Payload() data: any) {
    return this.paymentsService.createPayment(data);
  }

  @MessagePattern('get_payment')
  async getPayment(@Payload() data: { id: string; correlationId: string }) {
    return this.paymentsService.getPayment(data.id);
  }
}

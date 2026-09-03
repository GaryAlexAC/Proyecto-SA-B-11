import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentStatus, PaymentType } from '@prisma/client-payment';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async createPayment(data: any) {
    this.logger.log(`Creating payment...`);
    const correlationId = data.correlationId;

    // Simulate validation
    const isApproved = Math.random() > 0.2; // 80% chance to approve

    const payment = await this.prisma.payment.create({
      data: {
        correlationId,
        transactionId: data.transactionId || 'none',
        amount: data.amount,
        type: data.type || PaymentType.INTERNAL,
        status: isApproved ? PaymentStatus.APPROVED : PaymentStatus.REJECTED,
        description: data.description,
        failReason: isApproved ? null : 'Simulated rejection',
      },
    });

    const eventName = isApproved ? 'PaymentApproved' : 'PaymentRejected';
    this.notificationClient.emit(eventName, {
      eventId: crypto.randomUUID(),
      eventType: eventName,
      correlationId,
      producer: 'payment-service',
      payload: {
        paymentId: payment.id,
        amount: data.amount,
        reason: payment.failReason,
      },
    });

    return payment;
  }

  async getPayment(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }
}

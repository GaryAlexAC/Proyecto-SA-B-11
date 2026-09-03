import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TransactionsService } from '../transactions/transactions.service.js';

@Controller()
export class AccountEventsController {
  private readonly logger = new Logger(AccountEventsController.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  @EventPattern('TransferCompleted')
  async handleTransferCompleted(@Payload() data: any) {
    this.logger.log(
      `Transfer completed for correlationId: ${data.correlationId}`,
    );
    await this.transactionsService.completeTransaction(
      data.correlationId,
      data.eventId,
    );
  }

  @EventPattern('TransferFailed')
  async handleTransferFailed(@Payload() data: any) {
    this.logger.log(`Transfer failed for correlationId: ${data.correlationId}`);
    await this.transactionsService.failTransaction(
      data.correlationId,
      data.payload?.reason || 'Unknown error',
      data.eventId,
    );
  }
}

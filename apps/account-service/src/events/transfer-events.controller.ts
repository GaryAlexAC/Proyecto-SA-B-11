import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  AccountCommandResult,
  AccountsService,
} from '../accounts/accounts.service.js';
import { MessagingService } from '../messaging/messaging.service.js';

const RESULT_EVENT_IDS: Record<string, string> = {
  FundsReserved: 'funds-reserved',
  FundsReservationRejected: 'funds-reservation-rejected',
  DestinationCredited: 'destination-credited',
  DestinationCreditRejected: 'destination-credit-rejected',
  FundsReleased: 'funds-released',
};

function flatten(data: any): any {
  if (data && typeof data.payload === 'object' && data.payload !== null) {
    return { ...data, ...data.payload };
  }
  return data;
}

@Controller()
export class TransferEventsController {
  private readonly logger = new Logger(TransferEventsController.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly messaging: MessagingService,
  ) {}

  @EventPattern('ReserveFunds')
  async handleReserveFunds(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `ReserveFunds command received: correlationId=${data.correlationId}`,
    );

    const result = await this.accountsService.reserveFunds(
      data.sourceAccountId,
      data.targetAccountId,
      data.amount,
      data.correlationId,
      data.eventId,
      data.customerId,
    );
    await this.publishResult(data, result);
  }

  @EventPattern('CreditDestination')
  async handleCreditDestination(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `CreditDestination command received: correlationId=${data.correlationId}`,
    );

    const result = await this.accountsService.applyCredit(
      data.sourceAccountId,
      data.targetAccountId,
      data.amount,
      data.correlationId,
      data.eventId,
    );
    await this.publishResult(data, result);
  }

  @EventPattern('ReleaseFunds')
  async handleReleaseFunds(@Payload() data: any) {
    data = flatten(data);
    this.logger.log(
      `ReleaseFunds command received for correlationId=${data.correlationId}`,
    );

    const result = await this.accountsService.refundFunds(
      data.sourceAccountId,
      data.targetAccountId,
      data.amount,
      data.correlationId,
      data.eventId,
      data.reason,
    );
    await this.publishResult(data, result);
  }

  private async publishResult(command: any, result: AccountCommandResult) {
    const suffix = RESULT_EVENT_IDS[result.eventType];
    if (!suffix) {
      throw new Error(`Unsupported account result: ${result.eventType}`);
    }

    if (result.replayed) {
      this.logger.log(
        `Replaying ${result.eventType} for command ${command.eventId}`,
      );
      await this.messaging.publish(result.eventType, {
        eventId: `${command.correlationId}:${suffix}`,
        eventType: result.eventType,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        correlationId: command.correlationId,
        causationId: command.eventId,
        producer: 'account-service',
        ...result.payload,
      });
      return;
    }

    void this.messaging.flush();
  }
}

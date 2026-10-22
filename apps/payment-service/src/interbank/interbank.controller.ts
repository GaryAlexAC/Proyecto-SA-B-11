import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InterbankService } from './interbank.service.js';

@Controller()
export class InterbankController {
  constructor(private readonly interbankService: InterbankService) {}

  @MessagePattern('interbank_health')
  health() {
    return {
      status: 'UP',
      bankCode: this.interbankService.bankCode,
    };
  }

  @MessagePattern('interbank_receive_transfer')
  receiveTransfer(
    @Payload()
    data: {
      payload: any;
      traceparent?: string;
      idempotencyKey?: string;
    },
  ) {
    return this.interbankService.receiveTransfer(
      data.payload,
      data.traceparent,
      data.idempotencyKey,
    );
  }

  @MessagePattern('interbank_get_transfer')
  getTransfer(@Payload() data: { id: string }) {
    return this.interbankService.getTransfer(data.id);
  }

  @MessagePattern('interbank_cancel_transfer')
  cancelTransfer(@Payload() data: { id: string; reason: any }) {
    return this.interbankService.cancelTransfer(data.id, data.reason);
  }

  @MessagePattern('interbank_receive_result')
  receiveResult(@Payload() data: { payload: any; traceparent?: string }) {
    return this.interbankService.receiveTransferResult(
      data.payload,
      data.traceparent,
    );
  }

  @MessagePattern('interbank_reconciliation')
  reconciliation(
    @Payload()
    data: {
      date: string;
      page?: number;
      pageSize?: number;
      callingBankCode: string;
    },
  ) {
    return this.interbankService.getReconciliation(
      data.date,
      data.page,
      data.pageSize,
      data.callingBankCode,
    );
  }

  @MessagePattern('interbank_initiate_outgoing')
  initiateOutgoing(
    @Payload()
    data: {
      dto: any;
      customerId: string;
      correlationId: string;
      traceparent?: string;
    },
  ) {
    return this.interbankService.initiateOutgoingTransfer(
      data.dto,
      data.customerId,
      data.correlationId,
      data.traceparent,
    );
  }

  @MessagePattern('interbank_list_transfers')
  listTransfers(@Payload() data: { limit?: number }) {
    return this.interbankService.listTransfers(data.limit);
  }

  @MessagePattern('interbank_get_mock_config')
  getMockConfig() {
    return this.interbankService.getMockConfig();
  }

  @MessagePattern('interbank_update_mock_config')
  updateMockConfig(@Payload() data: { config: any }) {
    return this.interbankService.updateMockConfig(data.config);
  }
}

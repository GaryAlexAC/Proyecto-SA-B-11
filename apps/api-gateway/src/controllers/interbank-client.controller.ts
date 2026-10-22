import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

@Controller('api/interbank')
export class InterbankClientController {
  constructor(
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  @Post('transfers')
  async initiateTransfer(
    @Body() body: any,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('traceparent') traceparent?: string,
  ) {
    if (!authorization) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    // Extraer customerId del JWT si es posible
    let customerId = '';
    try {
      const token = authorization.replace(/^Bearer\s+/i, '');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf-8'),
        );
        customerId = payload.sub || payload.customerId || '';
      }
    } catch {
      // ignore
    }

    return rpcToHttp(
      this.paymentClient.send('interbank_initiate_outgoing', {
        dto: body,
        customerId,
        correlationId: request.correlationId,
        traceparent,
      }),
      'Payment Service',
    );
  }

  @Get('transfers')
  async listTransfers() {
    return rpcToHttp(
      this.paymentClient.send('interbank_list_transfers', { limit: 50 }),
      'Payment Service',
    );
  }

  @Get('mock/config')
  async getMockConfig() {
    return rpcToHttp(
      this.paymentClient.send('interbank_get_mock_config', {}),
      'Payment Service',
    );
  }

  @Post('mock/config')
  async updateMockConfig(@Body() body: any) {
    return rpcToHttp(
      this.paymentClient.send('interbank_update_mock_config', { config: body }),
      'Payment Service',
    );
  }
}

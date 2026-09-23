import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerHttpService } from '../customer-http.service.js';
import type { CorrelatedRequest } from '../request-context.js';
import { rpcToHttp } from '../rpc-to-http.js';

const photoOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 4 * 1024,
    parts: 11,
  },
};

@Controller('api/customers')
export class CustomerController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly client: ClientProxy,
    private readonly customerHttp: CustomerHttpService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('identityPhoto', photoOptions))
  registerCustomer(
    @Body() data: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customerHttp.registerCustomer(data, file, {
      authorization,
      correlationId: request.correlationId,
      idempotencyKey,
    });
  }

  @Get()
  listCustomers(
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('list_customers', {
        authorization,
        correlationId: request.correlationId,
      }),
    );
  }

  @Get(':id')
  getCustomer(
    @Param('id') id: string,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
  ) {
    return rpcToHttp(
      this.client.send('get_customer', {
        id,
        authorization,
        correlationId: request.correlationId,
      }),
    );
  }

  @Patch(':id')
  updateCustomer(
    @Param('id') id: string,
    @Body() customer: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.client.send('update_customer', {
        id,
        customer,
        authorization,
        correlationId: request.correlationId,
        idempotencyKey,
      }),
    );
  }

  @Patch(':id/kyc-status')
  updateKycStatus(
    @Param('id') id: string,
    @Body() kyc: Record<string, unknown>,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.client.send('update_kyc_status', {
        id,
        kyc,
        authorization,
        correlationId: request.correlationId,
        idempotencyKey,
      }),
    );
  }

  @Put(':id/identity-document')
  @UseInterceptors(FileInterceptor('identityPhoto', photoOptions))
  updateIdentityDocument(
    @Param('id') id: string,
    @Body() data: Record<string, unknown>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customerHttp.updateIdentityDocument(id, data, file, {
      authorization,
      correlationId: request.correlationId,
      idempotencyKey,
    });
  }

  @Post(':id/block')
  blockCustomer(
    @Param('id') id: string,
    @Body('version') version: number,
    @Req() request: CorrelatedRequest,
    @Headers('authorization') authorization?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return rpcToHttp(
      this.client.send('block_customer', {
        id,
        version,
        authorization,
        correlationId: request.correlationId,
        idempotencyKey,
      }),
    );
  }
}

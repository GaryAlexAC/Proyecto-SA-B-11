import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerRole } from '../generated/prisma/index.js';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentUser } from '../common/current-user.js';
import {
  CreateCashierDto,
  RegisterCustomerDto,
  UpdateKycStatusDto,
  UpdateCustomerDto,
  VersionDto,
} from './customer.dto.js';
import { CustomersService } from './customers.service.js';

type AuthenticatedRequest = Request & { user: CurrentUser };

const photoOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 4 * 1024,
    parts: 11,
  },
};

@Controller()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('customers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.CASHIER)
  @UseInterceptors(FileInterceptor('identityPhoto', photoOptions))
  registerCustomer(
    @Body() dto: RegisterCustomerDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.registerCustomer(
      dto,
      file,
      correlationId || crypto.randomUUID(),
      idempotencyKey,
    );
  }

  @Post('cashiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.ADMIN)
  createCashier(
    @Body() dto: CreateCashierDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.createCashier(
      dto,
      correlationId || crypto.randomUUID(),
      idempotencyKey,
    );
  }

  @Get('customers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.ADMIN, CustomerRole.CASHIER)
  list() {
    return this.customersService.list();
  }

  @Get('customers/:id')
  @UseGuards(JwtAuthGuard)
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.getAuthorized(id, request.user);
  }

  @Patch('customers/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.update(id, dto, request.user, idempotencyKey);
  }

  @Put('customers/:id/identity-document')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.ADMIN, CustomerRole.CASHIER)
  @UseInterceptors(FileInterceptor('identityPhoto', photoOptions))
  updateIdentityDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VersionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.updateIdentityPhoto(
      id,
      dto.version,
      file,
      idempotencyKey,
    );
  }

  @Post('customers/:id/block')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.ADMIN)
  block(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VersionDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.block(
      id,
      dto.version,
      correlationId || crypto.randomUUID(),
      idempotencyKey,
    );
  }

  @Patch('customers/:id/kyc-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CustomerRole.ADMIN)
  updateKycStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateKycStatusDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.customersService.updateKycStatus(
      id,
      dto,
      request.user,
      correlationId || crypto.randomUUID(),
      idempotencyKey,
    );
  }
}

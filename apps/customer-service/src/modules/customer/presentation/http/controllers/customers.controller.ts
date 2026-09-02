import { Body, Controller, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from '../../security/jwt-auth.guard';
import { RegisterCustomerDto } from '../dto/register-customer.dto';
import { UpdateIdentityDocumentDto } from '../dto/update-identity-document.dto';
import { CustomersService } from '../../../application/customers.service';
import { Errors } from '../../../../../common/application/errors/app-error';
import { UploadedIdentityPhoto, validateIdentityDocument } from '../identity-document.validator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('identityPhoto', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 11, fieldSize: 4 * 1024 } }))
  async register(@Body() dto: RegisterCustomerDto, @UploadedFile() identityPhoto: UploadedIdentityPhoto | undefined, @Req() request: AuthenticatedRequest) {
    if (request.user.role !== 'CASHIER') throw Errors.forbidden();
    return this.customersService.register(dto, validateIdentityDocument(identityPhoto), this.correlationId(request), this.idempotencyKey(request));
  }

  @Put(':id/identity-document')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('identityPhoto', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, parts: 11, fieldSize: 4 * 1024 } }))
  async updateIdentityDocument(@Param('id') id: string, @Body() dto: UpdateIdentityDocumentDto, @UploadedFile() identityPhoto: UploadedIdentityPhoto | undefined, @Req() request: AuthenticatedRequest) {
    if (!['ADMIN', 'CASHIER'].includes(request.user.role)) throw Errors.forbidden();
    return this.customersService.updateIdentityDocument(id, dto.version, validateIdentityDocument(identityPhoto), this.correlationId(request), this.idempotencyKey(request));
  }

  private correlationId(request: Request): string {
    const value = request.header('x-correlation-id');
    if (!value || value.length > 100) throw Errors.validation([{ field: 'x-correlation-id', message: 'El correlationId enviado por el API Gateway es obligatorio' }]);
    return value;
  }

  private idempotencyKey(request: Request): string | undefined {
    const value = request.header('idempotency-key');
    if (value === undefined) return undefined;
    if (!value.trim() || value.length > 100) throw Errors.validation([{ field: 'idempotency-key', message: 'La clave debe contener entre 1 y 100 caracteres' }]);
    return value;
  }

}

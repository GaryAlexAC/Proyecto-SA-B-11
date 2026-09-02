import { Controller, Logger, Type, ValidationError } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppError, Errors, ValidationDetail } from '../../../../../common/application/errors/app-error';
import { CustomersService } from '../../../application/customers.service';
import { UpdateCustomerDto } from '../../../presentation/http/dto/update-customer.dto';
import { AuthService } from '../../application/auth.service';
import { CreateCashierDto } from '../../../presentation/rmq/dto/create-cashier.dto';

interface RequestMetadata {
  correlationId: string;
  authorization?: string;
  idempotencyKey?: string;
}

@Controller()
export class CustomerMessageController {
  private readonly logger = new Logger(CustomerMessageController.name);

  constructor(private readonly customers: CustomersService, private readonly auth: AuthService) {}

  @MessagePattern('get_customer')
  async getCustomer(@Payload() payload: RequestMetadata & { id: string }) {
    return this.execute(payload, async () => {
      await this.auth.authorize(payload.authorization ?? '', { customerId: payload.id, allowedRoles: ['ADMIN', 'CASHIER'], allowSelf: true });
      return this.customers.findOne(payload.id);
    });
  }

  @MessagePattern('list_customers')
  async listCustomers(@Payload() payload: RequestMetadata) {
    return this.execute(payload, async () => {
      await this.auth.authorize(payload.authorization ?? '', { allowedRoles: ['ADMIN', 'CASHIER'] });
      return this.customers.findClients();
    });
  }

  @MessagePattern('create_cashier')
  async createCashier(@Payload() payload: RequestMetadata & { data: CreateCashierDto }) {
    return this.execute(payload, async () => {
      await this.auth.authorize(payload.authorization ?? '', { allowedRoles: ['ADMIN'] });
      return this.customers.createCashier(await this.validateDto(CreateCashierDto, payload.data), payload.correlationId, payload.idempotencyKey);
    });
  }

  @MessagePattern('update_customer')
  async updateCustomer(@Payload() payload: RequestMetadata & { id: string; data: UpdateCustomerDto }) {
    return this.execute(payload, async () => {
      await this.auth.authorize(payload.authorization ?? '', { customerId: payload.id, allowSelf: true });
      return this.customers.update(payload.id, await this.validateDto(UpdateCustomerDto, payload.data), payload.correlationId, payload.idempotencyKey);
    });
  }

  @MessagePattern('block_customer')
  async blockCustomer(@Payload() payload: RequestMetadata & { id: string; version: number }) {
    return this.execute(payload, async () => {
      if (!Number.isInteger(payload.version) || payload.version < 1) throw Errors.validation([{ field: 'version', message: 'version debe ser un entero mayor o igual a 1' }]);
      await this.auth.authorize(payload.authorization ?? '', { allowedRoles: ['ADMIN'] });
      return this.customers.block(payload.id, payload.version, payload.correlationId, payload.idempotencyKey);
    });
  }

  @MessagePattern('login_customer')
  login(@Payload() payload: RequestMetadata & { username: string; password: string }) {
    return this.execute(payload, () => {
      if (typeof payload.username !== 'string' || typeof payload.password !== 'string' || !payload.username.trim() || !payload.password) throw Errors.validation([{ field: 'credentials', message: 'Username y contraseña son obligatorios' }]);
      return this.auth.login(payload.username, payload.password, payload.correlationId);
    });
  }

  @MessagePattern('activate_customer')
  activate(@Payload() payload: RequestMetadata & { token: string }) {
    return this.execute(payload, () => {
      if (typeof payload.token !== 'string' || !payload.token) throw Errors.validation([{ field: 'token', message: 'El token es obligatorio' }]);
      return this.auth.activate(payload.token, payload.correlationId);
    });
  }

  private validateMetadata(payload: RequestMetadata): void {
    if (!payload?.correlationId) throw Errors.validation([{ field: 'correlationId', message: 'correlationId es obligatorio' }]);
    if (typeof payload.correlationId !== 'string' || payload.correlationId.length > 100) throw Errors.validation([{ field: 'correlationId', message: 'correlationId debe ser un texto de máximo 100 caracteres' }]);
    if (payload.idempotencyKey !== undefined && (typeof payload.idempotencyKey !== 'string' || !payload.idempotencyKey.trim() || payload.idempotencyKey.length > 100)) throw Errors.validation([{ field: 'idempotencyKey', message: 'idempotencyKey debe contener entre 1 y 100 caracteres' }]);
  }

  private async validateDto<T extends object>(type: Type<T>, value: unknown): Promise<T> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Errors.validation([{ field: 'data', message: 'El cuerpo de la solicitud es obligatorio' }]);
    const dto = plainToInstance(type, value);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) throw Errors.validation(this.validationDetails(errors));
    return dto;
  }

  private validationDetails(errors: ValidationError[], parent = ''): ValidationDetail[] {
    return errors.flatMap((error) => {
      const field = parent ? `${parent}.${error.property}` : error.property;
      return [...Object.values(error.constraints ?? {}).map((message) => ({ field, message })), ...this.validationDetails(error.children ?? [], field)];
    });
  }

  private async execute<T>(payload: RequestMetadata, operation: () => Promise<T>): Promise<T> {
    try {
      this.validateMetadata(payload);
      return await operation();
    } catch (error) {
      if (error instanceof AppError) {
        throw new RpcException({ statusCode: error.statusCode, code: error.code, message: error.message, details: error.details ?? [], correlationId: payload?.correlationId });
      }
      this.logger.error('Error inesperado procesando una solicitud de Customer Service', error);
      throw new RpcException({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: [], correlationId: payload?.correlationId });
    }
  }
}

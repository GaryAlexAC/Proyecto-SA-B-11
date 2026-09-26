import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import {
  EventPattern,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from '../auth/auth.service.js';
import { LoginDto } from '../auth/login.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CustomerRole } from '../generated/prisma/index.js';
import { CustomersService } from './customers.service.js';
import {
  CreateCashierDto,
  UpdateCustomerDto,
  UpdateKycStatusDto,
} from './customer.dto.js';

interface AuthorizedMessage {
  authorization: string;
  correlationId: string;
  idempotencyKey?: string;
}

@Controller()
export class CustomerMessageController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly authService: AuthService,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  @MessagePattern('login_customer')
  login(@Payload() data: { username: string; password: string; correlationId: string }) {
    return this.execute(async () => {
      const dto = await this.validateDto(LoginDto, {
        username: data.username,
        password: data.password,
      });
      return this.authService.login(dto, this.getCorrelationId(data.correlationId));
    });
  }

  @MessagePattern('activate_customer')
  activate(@Payload() data: { token: string; correlationId: string }) {
    return this.execute(() =>
      this.authService.activate(data.token, this.getCorrelationId(data.correlationId)),
    );
  }

  @MessagePattern('create_cashier')
  createCashier(@Payload() data: AuthorizedMessage & { customer: CreateCashierDto }) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      if (actor.role !== CustomerRole.ADMIN) {
        throw new ForbiddenException('Solo un administrador puede registrar cajeros');
      }
      const customer = await this.validateDto(CreateCashierDto, data.customer);
      return this.customersService.createCashier(
        customer,
        this.getCorrelationId(data.correlationId),
        data.idempotencyKey,
      );
    });
  }

  @MessagePattern('list_customers')
  list(@Payload() data: AuthorizedMessage) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      if (
        actor.role !== CustomerRole.ADMIN &&
        actor.role !== CustomerRole.CASHIER
      ) {
        throw new ForbiddenException('No puede listar usuarios');
      }
      return this.customersService.list();
    });
  }

  @MessagePattern('get_customer')
  get(@Payload() data: AuthorizedMessage & { id: string }) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      return this.customersService.getAuthorized(data.id, actor);
    });
  }

  @MessagePattern('update_customer')
  update(@Payload() data: AuthorizedMessage & { id: string; customer: UpdateCustomerDto }) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      const customer = await this.validateDto(UpdateCustomerDto, data.customer);
      return this.customersService.update(
        data.id,
        customer,
        actor,
        data.idempotencyKey,
      );
    });
  }

  @MessagePattern('block_customer')
  block(@Payload() data: AuthorizedMessage & { id: string; version: number }) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      if (actor.role !== CustomerRole.ADMIN) {
        throw new ForbiddenException('Solo un administrador puede bloquear usuarios');
      }
      if (!Number.isInteger(data.version) || data.version < 1) {
        throw new BadRequestException('version debe ser un entero positivo');
      }
      return this.customersService.block(
        data.id,
        data.version,
        this.getCorrelationId(data.correlationId),
        data.idempotencyKey,
      );
    });
  }

  @MessagePattern('update_kyc_status')
  updateKycStatus(
    @Payload()
    data: AuthorizedMessage & {
      id: string;
      kyc: UpdateKycStatusDto;
    },
  ) {
    return this.execute(async () => {
      const actor = await this.jwtGuard.authenticate(data.authorization);
      if (actor.role !== CustomerRole.ADMIN) {
        throw new ForbiddenException(
          'Solo un administrador puede actualizar el estado KYC',
        );
      }
      const kyc = await this.validateDto(UpdateKycStatusDto, data.kyc);
      return this.customersService.updateKycStatus(
        data.id,
        kyc,
        actor,
        this.getCorrelationId(data.correlationId),
        data.idempotencyKey,
      );
    });
  }

@EventPattern('KycValidationRequested')
  validateKyc(@Payload() data: unknown) {
    return this.execute(() => {
      type Request = Parameters<CustomersService['validateKyc']>[0];
      const envelope = data as {
        eventId?: string;
        correlationId?: string;
        payload?: Record<string, unknown>;
      };
      const request: Request =
        envelope && typeof envelope.payload === 'object' && envelope.payload
          ? ({
              eventId: envelope.eventId,
              correlationId: envelope.correlationId,
              payload: envelope.payload,
            } as Request)
          : (data as Request);
      return this.customersService.validateKyc(request);
    });
  }

  private async execute<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RpcException) throw error;
      if (error instanceof HttpException) {
        throw new RpcException({
          statusCode: error.getStatus(),
          error: error.getResponse(),
        });
      }
      throw new RpcException({ statusCode: 500, error: 'INTERNAL_ERROR' });
    }
  }

  private async validateDto<T extends object>(
    type: new () => T,
    value: unknown,
  ): Promise<T> {
    const dto = plainToInstance(type, value);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) throw new BadRequestException('Datos inválidos');
    return dto;
  }

  private getCorrelationId(value: string) {
    if (!value || value.length > 100) {
      throw new BadRequestException('correlationId es obligatorio');
    }
    return value;
  }
}

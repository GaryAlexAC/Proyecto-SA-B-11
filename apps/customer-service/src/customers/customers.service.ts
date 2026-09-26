import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Customer,
  CustomerRole,
  CustomerStatus,
  KycStatus,
  Prisma,
} from '../generated/prisma/index.js';
import { hash } from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { CurrentUser } from '../common/current-user.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateCashierDto,
  RegisterCustomerDto,
  UpdateKycStatusDto,
  UpdateCustomerDto,
} from './customer.dto.js';
import { validateIdentityPhoto } from './identity-photo.js';

type PublicCustomer = Omit<
  Customer,
  | 'passwordHash'
  | 'identityPhoto'
  | 'activationTokenHash'
  | 'activationTokenExpiresAt'
> & { hasIdentityPhoto: boolean };

interface KycValidationRequested {
  eventId: string;
  correlationId: string;
  payload: {
    transactionId: string;
    customerId: string;
    sourceAccountId: string;
    initiatedBy?: string;
    initiatorRole?: string;
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  async registerCustomer(
    dto: RegisterCustomerDto,
    file: Express.Multer.File | undefined,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const replay = await this.findIdempotent(idempotencyKey, 'register_customer');
    if (replay) return this.toPublic(replay);

    const photo = validateIdentityPhoto(file);
    const birthDate = this.parseBirthDate(dto.birthDate);
    this.validatePassword(dto.password);
    const username = await this.generateUsername(dto.fullName);

    try {
      const customer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            fullName: dto.fullName,
            document: dto.document,
            email: dto.email,
            birthDate,
            address: dto.address,
            identityPhoto: photo.buffer,
            identityPhotoMimeType: photo.mimeType,
            passwordHash: await hash(dto.password, 12),
            username,
            role: CustomerRole.CLIENT,
            status: CustomerStatus.INACTIVE,
          },
        });
        if (idempotencyKey) {
          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              operation: 'register_customer',
              resourceId: created.id,
            },
          });
        }
        await tx.outboxEvent.create({
          data: this.messaging.eventData('CustomerRegistered', correlationId, {
            customerId: created.id,
            username: created.username,
            email: created.email,
            role: created.role,
            status: created.status,
          }),
        });
        return created;
      });

      void this.messaging.flush();
      return this.toPublic(customer);
    } catch (error) {
      return this.handleWriteError(error, idempotencyKey, 'register_customer');
    }
  }

  async createCashier(
    dto: CreateCashierDto,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const replay = await this.findIdempotent(idempotencyKey, 'create_cashier');
    if (replay) return this.toPublic(replay);

    this.validatePassword(dto.password);
    const username = await this.generateUsername(dto.fullName);
    try {
      const cashier = await this.prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            fullName: dto.fullName,
            document: dto.document,
            email: dto.email,
            birthDate: this.parseBirthDate(dto.birthDate),
            address: dto.address,
            passwordHash: await hash(dto.password, 12),
            username,
            role: CustomerRole.CASHIER,
            status: CustomerStatus.ACTIVE,
            activatedAt: new Date(),
          },
        });
        if (idempotencyKey) {
          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              operation: 'create_cashier',
              resourceId: created.id,
            },
          });
        }
        await tx.outboxEvent.create({
          data: this.messaging.eventData('CustomerRegistered', correlationId, {
            customerId: created.id,
            username: created.username,
            email: created.email,
            role: created.role,
            status: created.status,
          }),
        });
        return created;
      });

      void this.messaging.flush();
      return this.toPublic(cashier);
    } catch (error) {
      return this.handleWriteError(error, idempotencyKey, 'create_cashier');
    }
  }

  async list() {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return customers.map((customer) => this.toPublic(customer));
  }

  async getAuthorized(id: string, actor: CurrentUser) {
    if (
      actor.customerId !== id &&
      actor.role !== CustomerRole.ADMIN &&
      actor.role !== CustomerRole.CASHIER
    ) {
      throw new ForbiddenException('No puede consultar este usuario');
    }
    return this.toPublic(await this.getById(id));
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actor: CurrentUser,
    idempotencyKey?: string,
  ) {
    if (actor.customerId !== id && actor.role !== CustomerRole.ADMIN) {
      throw new ForbiddenException('No puede actualizar este usuario');
    }
    const replay = await this.findIdempotent(
      idempotencyKey,
      'update_customer',
      id,
    );
    if (replay) return this.toPublic(replay);
    if (dto.birthDate) this.parseBirthDate(dto.birthDate);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.customer.updateMany({
          where: { id, version: dto.version },
          data: {
            fullName: dto.fullName,
            email: dto.email,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
            address: dto.address,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException('La información fue modificada por otra solicitud');
        }
        if (idempotencyKey) {
          await tx.idempotencyRecord.create({
            data: { key: idempotencyKey, operation: 'update_customer', resourceId: id },
          });
        }
        return tx.customer.findUniqueOrThrow({ where: { id } });
      });
      return this.toPublic(updated);
    } catch (error) {
      return this.handleWriteError(error, idempotencyKey, 'update_customer', id);
    }
  }

  async updateIdentityPhoto(
    id: string,
    version: number,
    file: Express.Multer.File | undefined,
    idempotencyKey?: string,
  ) {
    const replay = await this.findIdempotent(
      idempotencyKey,
      'update_identity_photo',
      id,
    );
    if (replay) return this.toPublic(replay);
    const photo = validateIdentityPhoto(file);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: { id, version },
        data: {
          identityPhoto: photo.buffer,
          identityPhotoMimeType: photo.mimeType,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('La información fue modificada por otra solicitud');
      }
      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            operation: 'update_identity_photo',
            resourceId: id,
          },
        });
      }
      return tx.customer.findUniqueOrThrow({ where: { id } });
    });
    return this.toPublic(updated);
  }

  async block(
    id: string,
    version: number,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const replay = await this.findIdempotent(
      idempotencyKey,
      'block_customer',
      id,
    );
    if (replay) return this.toPublic(replay);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: { id, version, status: { not: CustomerStatus.BLOCKED } },
        data: { status: CustomerStatus.BLOCKED, version: { increment: 1 } },
      });
      if (result.count !== 1) {
        throw new ConflictException('El usuario ya está bloqueado o cambió de versión');
      }
      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: { key: idempotencyKey, operation: 'block_customer', resourceId: id },
        });
      }
      await tx.outboxEvent.create({
        data: this.messaging.eventData('CustomerBlocked', correlationId, {
          customerId: id,
        }),
      });
      return tx.customer.findUniqueOrThrow({ where: { id } });
    });

    void this.messaging.flush();
    return this.toPublic(updated);
  }

  async updateKycStatus(
    id: string,
    dto: UpdateKycStatusDto,
    actor: CurrentUser,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    const replay = await this.findIdempotent(
      idempotencyKey,
      'update_kyc_status',
      id,
    );
    if (replay) return this.toPublic(replay);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const current = await tx.customer.findUnique({ where: { id } });
        if (!current || current.role !== CustomerRole.CLIENT) {
          throw new NotFoundException('Cliente no encontrado');
        }

        const result = await tx.customer.updateMany({
          where: { id, version: dto.version, role: CustomerRole.CLIENT },
          data: {
            kycStatus: dto.kycStatus,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new ConflictException(
            'El estado KYC fue modificado por otra solicitud',
          );
        }

        if (idempotencyKey) {
          await tx.idempotencyRecord.create({
            data: {
              key: idempotencyKey,
              operation: 'update_kyc_status',
              resourceId: id,
            },
          });
        }

        await tx.outboxEvent.create({
          data: this.messaging.eventData('KYCStatusUpdated', correlationId, {
            customerId: id,
            previousStatus: current.kycStatus,
            kycStatus: dto.kycStatus,
            updatedBy: actor.customerId,
            updaterRole: actor.role,
            severity:
              dto.kycStatus === KycStatus.REJECTED ? 'WARNING' : 'INFO',
          }),
        });

        return tx.customer.findUniqueOrThrow({ where: { id } });
      });

      void this.messaging.flush();
      return this.toPublic(updated);
    } catch (error) {
      return this.handleWriteError(
        error,
        idempotencyKey,
        'update_kyc_status',
        id,
      );
    }
  }

  async validateKyc(request: KycValidationRequested) {
    const { eventId, correlationId, payload } = request;
    if (
      !eventId ||
      !correlationId ||
      !payload?.transactionId ||
      !payload.customerId ||
      !payload.sourceAccountId
    ) {
      throw new BadRequestException('Evento KycValidationRequested inválido');
    }

    const response = await this.prisma.$transaction(async (tx) => {
      const processed = await tx.processedEvent.findUnique({
        where: { eventId },
      });
      if (processed) return null;

const customer = await tx.customer.findUnique({
        where: { id: payload.customerId },
        select: {
          id: true,
          role: true,
          status: true,
          kycStatus: true,
        },
      });

      let reason: string | null = null;
      if (!customer) {
        reason = 'CUSTOMER_NOT_FOUND';
      } else if (customer.role !== CustomerRole.CLIENT) {
        reason = 'CUSTOMER_NOT_ELIGIBLE';
      } else if (customer.status !== CustomerStatus.ACTIVE) {
        reason = 'CUSTOMER_INACTIVE';
      } else if (customer.kycStatus === KycStatus.REJECTED) {
        reason = 'KYC_REJECTED';
      } else if (customer.kycStatus !== KycStatus.VERIFIED) {
        reason = 'KYC_NOT_VERIFIED';
      }

      if (!reason) {
        const initiatorRole = payload.initiatorRole || 'CLIENT';
        const initiatorId =
          initiatorRole === 'CLIENT'
            ? payload.customerId
            : payload.initiatedBy;
        let initiatorActive =
          initiatorRole === 'CLIENT';

        if (initiatorRole === 'CASHIER') {
          if (!initiatorId) {
            initiatorActive = false;
          } else {
            const initiator = await tx.customer.findUnique({
              where: { id: initiatorId },
              select: { role: true, status: true },
            });
            initiatorActive =
              initiator?.role === CustomerRole.CASHIER &&
              initiator.status === CustomerStatus.ACTIVE;
          }
        } else if (initiatorRole === 'ADMIN') {
          if (!initiatorId) {
            initiatorActive = false;
          } else {
            const initiator = await tx.customer.findUnique({
              where: { id: initiatorId },
              select: { role: true, status: true },
            });
            initiatorActive =
              initiator?.role === CustomerRole.ADMIN &&
              initiator.status === CustomerStatus.ACTIVE;
          }
        } else if (initiatorRole !== 'CLIENT') {
          initiatorActive = false;
        }

        if (!initiatorActive) reason = 'INITIATOR_NOT_ACTIVE';
      }

      const approved = reason === null;
      const eventType = approved
        ? 'KycValidationApproved'
        : 'KycValidationRejected';
      const responseEventId = `${correlationId}:${
        approved ? 'kyc-validation-approved' : 'kyc-validation-rejected'
      }`;
      const kycStatus = customer?.kycStatus ?? 'NOT_FOUND';

      await tx.outboxEvent.create({
        data: this.messaging.eventData(
          eventType,
          correlationId,
          {
            transactionId: payload.transactionId,
            customerId: payload.customerId,
            sourceAccountId: payload.sourceAccountId,
            kycStatus,
            ...(approved ? {} : { reason }),
          },
          { id: responseEventId, causationId: eventId },
        ),
      });
      await tx.processedEvent.create({
        data: { eventId, customerId: payload.customerId },
      });

      return { approved, kycStatus, reason: approved ? undefined : reason };
    });

    if (response) void this.messaging.flush();
    return response;
  }

  private async getById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Usuario no encontrado');
    return customer;
  }

  private async findIdempotent(
    key: string | undefined,
    operation: string,
    resourceId?: string,
  ) {
    if (!key) return null;
    if (key.length > 100) {
      throw new BadRequestException('Idempotency-Key no puede superar 100 caracteres');
    }
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record) return null;
    if (
      record.operation !== operation ||
      (resourceId !== undefined && record.resourceId !== resourceId)
    ) {
      throw new ConflictException('Idempotency-Key ya fue usada en otra operación');
    }
    return this.getById(record.resourceId);
  }

  private async handleWriteError(
    error: unknown,
    key: string | undefined,
    operation: string,
    resourceId?: string,
  ): Promise<PublicCustomer> {
    if (error instanceof ConflictException) {
      const replay = await this.findIdempotent(key, operation, resourceId);
      if (replay) return this.toPublic(replay);
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await this.findIdempotent(key, operation, resourceId);
      if (replay) return this.toPublic(replay);
      throw new ConflictException('Documento, correo o username ya registrado');
    }
    throw error;
  }

  private parseBirthDate(value: string) {
    const birthDate = new Date(value);
    const now = new Date();
    const oldest = new Date();
    oldest.setFullYear(now.getFullYear() - 120);
    if (Number.isNaN(birthDate.valueOf()) || birthDate > now || birthDate < oldest) {
      throw new BadRequestException('La fecha de nacimiento no es coherente');
    }
    return birthDate;
  }

  private validatePassword(password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('password no puede superar 72 bytes');
    }
  }

  private async generateUsername(fullName: string) {
    const parts = fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .split(/\s+/);
    const base = `${parts[0] || 'user'}.${parts.at(-1) || 'user'}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const username = `${base}.${randomInt(1000, 10000)}`;
      const exists = await this.prisma.customer.findUnique({ where: { username } });
      if (!exists) return username;
    }
    throw new ConflictException('No fue posible generar un username único');
  }

  private toPublic(customer: Customer): PublicCustomer {
    const {
      passwordHash: _passwordHash,
      identityPhoto,
      activationTokenHash: _activationTokenHash,
      activationTokenExpiresAt: _activationTokenExpiresAt,
      ...data
    } = customer;
    return { ...data, hasIdentityPhoto: Boolean(identityPhoto?.length) };
  }
}

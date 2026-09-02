import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Customer, Prisma } from '../../../generated/prisma/client';
import { MessagingService } from '../../../infrastructure/messaging/messaging.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RegisterCustomerDto } from '../presentation/http/dto/register-customer.dto';
import { UpdateCustomerDto } from '../presentation/http/dto/update-customer.dto';
import { Errors } from '../../../common/application/errors/app-error';
import { IdentityDocument } from '../domain/identity-document';
import { CreateCashierDto } from '../presentation/rmq/dto/create-cashier.dto';

const publicCustomerSelect = {
  id: true,
  fullName: true,
  document: true,
  email: true,
  birthDate: true,
  address: true,
  username: true,
  role: true,
  status: true,
  activatedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  identityPhotoChecksum: true,
} satisfies Prisma.CustomerSelect;

type PublicCustomerRecord = Prisma.CustomerGetPayload<{ select: typeof publicCustomerSelect }>;
type PublicCustomer = Omit<PublicCustomerRecord, 'identityPhotoChecksum'> & { hasIdentityPhoto: boolean };
type AuthenticationCustomer = Pick<Customer, 'id' | 'username' | 'email' | 'passwordHash' | 'role' | 'status' | 'activationTokenHash' | 'activationTokenExpiresAt'>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService, private readonly messaging: MessagingService) {}

  async register(dto: RegisterCustomerDto, identityDocument: IdentityDocument, correlationId: string, idempotencyKey?: string): Promise<PublicCustomer> {
    const data = this.normalizeRegistration(dto);
    this.validateBirthDate(data.birthDate);
    this.validatePassword(dto.password);
    const username = this.nextUsername(data.fullName);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) await tx.idempotencyRecord.create({ data: { key: idempotencyKey, operation: 'CUSTOMER_REGISTER' } });
        const customer = await tx.customer.create({
          data: { ...data, username, passwordHash, role: 'CLIENT', identityPhotoData: Uint8Array.from(identityDocument.data), identityPhotoMimeType: identityDocument.mimeType, identityPhotoChecksum: identityDocument.checksum },
          select: publicCustomerSelect,
        });
        if (idempotencyKey) await tx.idempotencyRecord.update({ where: { key: idempotencyKey }, data: { customerId: customer.id } });
        const event = await tx.outboxEvent.create({
          data: { eventType: 'CustomerRegistered', correlationId, payload: { customerId: customer.id, username: customer.username, status: customer.status } },
        });
        return { customer, eventId: event.id };
      });
      await this.messaging.dispatch(result.eventId);
      return this.toPublic(result.customer);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencyKey) {
        const record = await this.prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
        if (record?.operation === 'CUSTOMER_REGISTER' && record.customerId) return this.findOne(record.customerId);
        if (record) throw Errors.idempotencyKeyUsed();
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw Errors.customerAlreadyExists();
      throw error;
    }
  }

  async createCashier(dto: CreateCashierDto, correlationId: string, idempotencyKey?: string): Promise<PublicCustomer> {
    const birthDate = new Date(dto.birthDate);
    this.validateBirthDate(birthDate);
    this.validatePassword(dto.password);
    const username = this.nextUsername(dto.fullName);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) await tx.idempotencyRecord.create({ data: { key: idempotencyKey, operation: 'CASHIER_CREATE' } });
        const cashier = await tx.customer.create({
          data: {
            fullName: dto.fullName.trim(),
            document: dto.document.trim().toUpperCase(),
            email: dto.email.trim().toLowerCase(),
            birthDate,
            address: dto.address.trim(),
            username,
            passwordHash,
            role: 'CASHIER',
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
          select: publicCustomerSelect,
        });
        if (idempotencyKey) await tx.idempotencyRecord.update({ where: { key: idempotencyKey }, data: { customerId: cashier.id } });
        const event = await tx.outboxEvent.create({
          data: { eventType: 'CustomerRegistered', correlationId, payload: { customerId: cashier.id, username: cashier.username, role: cashier.role, status: cashier.status } },
        });
        return { cashier, eventId: event.id };
      });
      await this.messaging.dispatch(result.eventId);
      return this.toPublic(result.cashier);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencyKey) {
        const record = await this.prisma.idempotencyRecord.findUnique({ where: { key: idempotencyKey } });
        if (record?.operation === 'CASHIER_CREATE' && record.customerId) return this.findOne(record.customerId);
        if (record) throw Errors.idempotencyKeyUsed();
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw Errors.customerAlreadyExists();
      throw error;
    }
  }

  async findClients(): Promise<PublicCustomer[]> {
    const customers = await this.prisma.customer.findMany({ where: { role: 'CLIENT' }, orderBy: { createdAt: 'desc' }, select: publicCustomerSelect });
    return customers.map((customer) => this.toPublic(customer));
  }

  async findOne(id: string): Promise<PublicCustomer> {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: publicCustomerSelect });
    if (!customer) throw Errors.customerNotFound();
    return this.toPublic(customer);
  }

  async findAuthorizationState(id: string) {
    return this.prisma.customer.findUnique({ where: { id }, select: { id: true, username: true, role: true, status: true } });
  }

  async update(id: string, dto: UpdateCustomerDto, correlationId: string, idempotencyKey?: string): Promise<PublicCustomer> {
    if (!this.hasChanges(dto)) throw Errors.validation([{ field: 'body', message: 'Debe enviar al menos un campo para actualizar' }]);
    if (dto.birthDate) this.validateBirthDate(new Date(dto.birthDate));
    const { version, ...changes } = dto;
    const data = { ...changes, email: changes.email?.trim().toLowerCase(), fullName: changes.fullName?.trim(), address: changes.address?.trim(), birthDate: changes.birthDate ? new Date(changes.birthDate) : undefined };
    let customer: PublicCustomerRecord;
    try {
      customer = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) await tx.idempotencyRecord.create({ data: { key: idempotencyKey, operation: 'CUSTOMER_UPDATE', customerId: id } });
        const updated = await tx.customer.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
        if (updated.count === 0) {
          const current = await tx.customer.findUnique({ where: { id }, select: { version: true } });
          if (!current) throw Errors.customerNotFound();
          throw Errors.staleVersion();
        }
        return tx.customer.findUniqueOrThrow({ where: { id }, select: publicCustomerSelect });
      });
    } catch (error) {
      const replay = await this.replayIdempotentRequest(error, idempotencyKey, 'CUSTOMER_UPDATE', id);
      if (replay) return replay;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw Errors.customerAlreadyExists();
      throw error;
    }
    return this.toPublic(customer);
  }

  async block(id: string, version: number, correlationId: string, idempotencyKey?: string): Promise<PublicCustomer> {
    let result: { customer: PublicCustomerRecord; eventId: string };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) await tx.idempotencyRecord.create({ data: { key: idempotencyKey, operation: 'CUSTOMER_BLOCK', customerId: id } });
        const updated = await tx.customer.updateMany({ where: { id, version, role: 'CLIENT', status: { not: 'BLOCKED' } }, data: { status: 'BLOCKED', version: { increment: 1 } } });
        if (updated.count === 0) {
          const current = await tx.customer.findUnique({ where: { id }, select: { role: true, status: true, version: true } });
          if (!current) throw Errors.customerNotFound();
          if (current.role !== 'CLIENT') throw Errors.forbidden();
          if (current.status === 'BLOCKED') throw Errors.alreadyBlocked();
          throw Errors.staleVersion();
        }
        const customer = await tx.customer.findUniqueOrThrow({ where: { id }, select: publicCustomerSelect });
        const event = await tx.outboxEvent.create({ data: { eventType: 'CustomerBlocked', correlationId, payload: { customerId: id } } });
        return { customer, eventId: event.id };
      });
    } catch (error) {
      const replay = await this.replayIdempotentRequest(error, idempotencyKey, 'CUSTOMER_BLOCK', id);
      if (replay) return replay;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw Errors.idempotencyKeyUsed();
      throw error;
    }
    await this.messaging.dispatch(result.eventId);
    return this.toPublic(result.customer);
  }

  async updateIdentityDocument(id: string, version: number, identityDocument: IdentityDocument, correlationId: string, idempotencyKey?: string): Promise<PublicCustomer> {
    let customer: PublicCustomerRecord;
    try {
      customer = await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey) await tx.idempotencyRecord.create({ data: { key: idempotencyKey, operation: 'CUSTOMER_IDENTITY_DOCUMENT_UPDATE', customerId: id } });
        const updated = await tx.customer.updateMany({
          where: { id, version },
          data: { identityPhotoData: Uint8Array.from(identityDocument.data), identityPhotoMimeType: identityDocument.mimeType, identityPhotoChecksum: identityDocument.checksum, version: { increment: 1 } },
        });
        if (updated.count === 0) {
          const current = await tx.customer.findUnique({ where: { id }, select: { version: true } });
          if (!current) throw Errors.customerNotFound();
          throw Errors.staleVersion();
        }
        return tx.customer.findUniqueOrThrow({ where: { id }, select: publicCustomerSelect });
      });
    } catch (error) {
      const replay = await this.replayIdempotentRequest(error, idempotencyKey, 'CUSTOMER_IDENTITY_DOCUMENT_UPDATE', id);
      if (replay) return replay;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw Errors.idempotencyKeyUsed();
      throw error;
    }
    return this.toPublic(customer);
  }

  async validateCredentials(username: string, password: string): Promise<AuthenticationCustomer> {
    const customer = await this.prisma.customer.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: { id: true, username: true, email: true, passwordHash: true, role: true, status: true, activationTokenHash: true, activationTokenExpiresAt: true },
    });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) throw Errors.invalidCredentials();
    if (customer.status === 'BLOCKED') throw Errors.customerBlocked();
    return customer;
  }

  async requestActivation(customer: AuthenticationCustomer, correlationId: string): Promise<void> {
    if (customer.role !== 'CLIENT' || customer.status !== 'INACTIVE') return;
    if (customer.activationTokenHash && customer.activationTokenExpiresAt && customer.activationTokenExpiresAt > new Date()) return;
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashActivationToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const event = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.customer.updateMany({
        where: {
          id: customer.id,
          role: 'CLIENT',
          status: 'INACTIVE',
          OR: [{ activationTokenHash: null }, { activationTokenExpiresAt: { lte: new Date() } }],
        },
        data: { activationTokenHash: tokenHash, activationTokenExpiresAt: expiresAt },
      });
      if (claimed.count === 0) return null;
      return tx.outboxEvent.create({ data: { eventType: 'ActivationEmailRequested', correlationId, payload: { customerId: customer.id, email: customer.email, activationLink: `${process.env.ACTIVATION_URL_BASE}?token=${encodeURIComponent(token)}` } } });
    });
    if (event) await this.messaging.dispatch(event.id);
  }

  async activate(token: string, correlationId: string): Promise<PublicCustomer> {
    const activationTokenHash = this.hashActivationToken(token);
    const customer = await this.prisma.customer.findUnique({ where: { activationTokenHash } });
    if (!customer || customer.role !== 'CLIENT' || customer.status !== 'INACTIVE' || !customer.activationTokenExpiresAt || customer.activationTokenExpiresAt <= new Date()) throw Errors.invalidActivationToken();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({ where: { id: customer.id, status: 'INACTIVE', activationTokenHash: customer.activationTokenHash, activationTokenExpiresAt: { gt: new Date() } }, data: { status: 'ACTIVE', activationTokenHash: null, activationTokenExpiresAt: null, activatedAt: new Date(), version: { increment: 1 } } });
      if (updated.count === 0) throw Errors.activationAlreadyUsed();
      const activeCustomer = await tx.customer.findUniqueOrThrow({ where: { id: customer.id }, select: publicCustomerSelect });
      const event = await tx.outboxEvent.create({ data: { eventType: 'CustomerActivated', correlationId, payload: { customerId: customer.id } } });
      return { customer: activeCustomer, eventId: event.id };
    });
    await this.messaging.dispatch(result.eventId);
    return this.toPublic(result.customer);
  }

  private normalizeRegistration(dto: RegisterCustomerDto) {
    return { fullName: dto.fullName.trim(), document: dto.document.trim().toUpperCase(), email: dto.email.trim().toLowerCase(), birthDate: new Date(dto.birthDate), address: dto.address.trim() };
  }

  private validateBirthDate(birthDate: Date): void {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const minimum = new Date(today);
    minimum.setFullYear(minimum.getFullYear() - 120);
    minimum.setHours(0, 0, 0, 0);
    if (Number.isNaN(birthDate.getTime()) || birthDate > today || birthDate < minimum) throw Errors.validation([{ field: 'birthDate', message: 'La fecha de nacimiento no es coherente' }]);
  }

  private validatePassword(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > 72) throw Errors.validation([{ field: 'password', message: 'La contraseña no puede superar 72 bytes' }]);
  }

  private nextUsername(fullName: string): string {
    const root = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 40) || 'cliente';
    return `${root}.${randomBytes(4).toString('hex')}`;
  }

  private hasChanges(dto: UpdateCustomerDto): boolean {
    return Boolean(dto.fullName || dto.email || dto.birthDate || dto.address);
  }

  private async replayIdempotentRequest(error: unknown, key: string | undefined, operation: string, customerId: string): Promise<PublicCustomer | undefined> {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !key) return undefined;
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record) return undefined;
    if (record.operation === operation && record.customerId === customerId) return this.findOne(customerId);
    throw Errors.idempotencyKeyUsed();
  }

  private toPublic(customer: PublicCustomerRecord): PublicCustomer {
    const { identityPhotoChecksum, ...publicCustomer } = customer;
    return { ...publicCustomer, hasIdentityPhoto: identityPhotoChecksum !== null };
  }

  private hashActivationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

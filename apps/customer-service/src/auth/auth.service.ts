import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerStatus } from '../generated/prisma/index.js';
import { compare } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly messaging: MessagingService,
  ) {}

  async login(dto: LoginDto, correlationId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { username: dto.username.trim().toLowerCase() },
    });

    if (!customer || !(await compare(dto.password, customer.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (customer.status === CustomerStatus.BLOCKED) {
      throw new ForbiddenException('El usuario está bloqueado');
    }
    if (customer.status === CustomerStatus.INACTIVE) {
      await this.requestActivation(customer.id, customer.email, correlationId);
      throw new ForbiddenException({
        code: 'ACCOUNT_ACTIVATION_REQUIRED',
        message: 'La cuenta debe activarse. Se solicitó el correo de activación.',
      });
    }

    const accessToken = await this.jwtService.signAsync({
      sub: customer.id,
      username: customer.username,
      role: customer.role,
    });

    return {
      accessToken,
      user: {
        customerId: customer.id,
        username: customer.username,
        role: customer.role,
        status: customer.status,
      },
    };
  }

  async activate(token: string, correlationId: string) {
    if (!token) throw new BadRequestException('El token es obligatorio');

    const tokenHash = this.hashToken(token);
    const customer = await this.prisma.customer.findUnique({
      where: { activationTokenHash: tokenHash },
    });

    if (
      !customer ||
      !customer.activationTokenExpiresAt ||
      customer.activationTokenExpiresAt <= new Date() ||
      customer.status !== CustomerStatus.INACTIVE
    ) {
      throw new BadRequestException('Token de activación inválido o expirado');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: {
          id: customer.id,
          status: CustomerStatus.INACTIVE,
          activationTokenHash: tokenHash,
        },
        data: {
          status: CustomerStatus.ACTIVE,
          activatedAt: new Date(),
          activationTokenHash: null,
          activationTokenExpiresAt: null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new BadRequestException('El token de activación ya fue utilizado');
      }
      await tx.outboxEvent.create({
        data: this.messaging.eventData('CustomerActivated', correlationId, {
          customerId: customer.id,
          email: customer.email,
        }),
      });
    });
    void this.messaging.flush();

    return { customerId: customer.id, status: CustomerStatus.ACTIVE };
  }

  private async requestActivation(
    customerId: string,
    email: string,
    correlationId: string,
  ) {
    const token = randomBytes(32).toString('hex');
    const ttlHours = Number(process.env.ACTIVATION_TOKEN_TTL_HOURS ?? 24);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const baseUrl = process.env.ACTIVATION_URL_BASE ??
      'http://localhost:3000/api/auth/activate';
    const activationLink = `${baseUrl}?token=${encodeURIComponent(token)}`;

    const queued = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: {
          id: customerId,
          status: CustomerStatus.INACTIVE,
          OR: [
            { activationTokenHash: null },
            { activationTokenExpiresAt: { lte: new Date() } },
          ],
        },
        data: {
          activationTokenHash: this.hashToken(token),
          activationTokenExpiresAt: expiresAt,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) return false;
      await tx.outboxEvent.create({
        data: this.messaging.eventData('ActivationEmailRequested', correlationId, {
          customerId,
          email,
          activationLink,
        }),
      });
      return true;
    });
    if (queued) void this.messaging.flush();
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}

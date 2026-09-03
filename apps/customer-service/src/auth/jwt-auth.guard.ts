import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerStatus } from '../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUser } from '../common/current-user.js';

interface JwtPayload {
  sub: string;
  username: string;
  role: CurrentUser['role'];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: CurrentUser;
    }>();
    request.user = await this.authenticate(request.headers.authorization);
    return true;
  }

  async authenticate(authorization?: string): Promise<CurrentUser> {
    const token = this.extractToken(authorization);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true, status: true },
      });

      if (!customer || customer.status !== CustomerStatus.ACTIVE) {
        throw new UnauthorizedException('La sesión no está activa');
      }

      return {
        customerId: customer.id,
        username: customer.username,
        role: customer.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Se requiere un token Bearer');
    }
    return token;
  }
}

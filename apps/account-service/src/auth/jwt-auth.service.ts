import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';

export type UserRole = 'ADMIN' | 'CASHIER' | 'CLIENT';

export interface AuthenticatedUser {
  customerId: string;
  username: string;
  role: UserRole;
}

interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}

@Injectable()
export class JwtAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async authenticate(
    authorization: string | undefined,
    allowedRoles: UserRole[],
  ): Promise<AuthenticatedUser> {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      this.reject(401, 'Se requiere un token Bearer');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (
        !payload.sub ||
        !payload.username ||
        !['ADMIN', 'CASHIER', 'CLIENT'].includes(payload.role)
      ) {
        this.reject(401, 'Token inválido o expirado');
      }
      if (!allowedRoles.includes(payload.role)) {
        this.reject(403, 'No tiene permisos para realizar esta operación');
      }
      return {
        customerId: payload.sub,
        username: payload.username,
        role: payload.role,
      };
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.reject(401, 'Token inválido o expirado');
    }
  }

  assertCustomerAccess(actor: AuthenticatedUser, customerId: string) {
    if (actor.role === 'CLIENT' && actor.customerId !== customerId) {
      this.reject(403, 'No tiene permisos para consultar este cliente');
    }
  }

  private reject(statusCode: number, error: string): never {
    throw new RpcException({ statusCode, error });
  }
}
